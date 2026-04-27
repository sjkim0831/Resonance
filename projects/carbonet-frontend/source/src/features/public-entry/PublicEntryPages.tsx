import { FormEvent, ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { logGovernanceScope } from "../../app/policy/debug";
import { invalidateFrontendSessionCache } from "../../lib/api/adminShell";
import { fetchJson } from "../../lib/api/core";
import { buildLocalizedPath, getNavigationEventName, getSearchParam, isEnglish, navigate, replace } from "../../lib/navigation/runtime";
import { postJsonWithSession } from "./publicEntryApi";
import { LoginResponse, PublicFrame } from "./publicEntryShared";
import { AppButton, AppCheckbox, AppInput, AppLinkButton } from "../app-ui/primitives";

type ExternalAuthMethod = {
  providerCode: string;
  methodCode: string;
  displayName: string;
  description: string;
  icon: string;
  available: boolean;
  status: string;
  statusMessage: string;
  publicKeyJwk?: string;
};

type ExternalAuthMethodsPayload = {
  status?: string;
  methods?: ExternalAuthMethod[];
};

type ExternalAuthStartPayload = {
  status?: string;
  providerCode?: string;
  methodCode?: string;
  txId?: string;
  nextAction?: string;
  appScheme?: string;
  qrScheme?: string;
  urlScheme?: string;
  message?: string;
  mock?: boolean;
};

type ExternalAuthCompletePayload = {
  status?: string;
  errors?: string;
  userId?: string;
  userSe?: string;
  certified?: boolean;
  linkRequired?: boolean;
};

function isOverseasPath() {
  const path = window.location.pathname;
  return path.includes("/overseas/") || path.endsWith("/overseas");
}

function resolveLoginTabFromLocation(): "domestic" | "overseas" {
  const queryTab = getSearchParam("tab");
  if (queryTab === "overseas") {
    return "overseas";
  }
  return isOverseasPath() ? "overseas" : "domestic";
}

async function fetchExternalAuthMethods() {
  const response = await fetchJson<ExternalAuthMethodsPayload>(
    buildLocalizedPath("/signin/external-auth/methods", "/en/signin/external-auth/methods")
  );
  return Array.isArray(response.methods) ? response.methods : [];
}

async function startExternalAuth(methodCode: string, userId?: string, userSe?: string) {
  return postJsonWithSession<ExternalAuthStartPayload>(
    buildLocalizedPath("/signin/external-auth/start", "/en/signin/external-auth/start"),
    {
      methodCode,
      userId: userId || undefined,
      userSe: userSe || undefined
    }
  );
}

async function completeExternalAuth(methodCode: string, txId: string, userId?: string, userSe?: string) {
  return postJsonWithSession<ExternalAuthCompletePayload>(
    buildLocalizedPath("/signin/external-auth/complete", "/en/signin/external-auth/complete"),
    {
      methodCode,
      txId,
      userId: userId || undefined,
      userSe: userSe || undefined
    }
  );
}

export function PublicLoginPage() {
  const en = isEnglish();
  const [userId, setUserId] = useState("");
  const [userPw, setUserPw] = useState("");
  const [saveId, setSaveId] = useState(false);
  const [autoLogin, setAutoLogin] = useState(false);
  const [tab, setTab] = useState<"domestic" | "overseas">(() => resolveLoginTabFromLocation());
  const [submitting, setSubmitting] = useState(false);
  const [externalAuthSubmitting, setExternalAuthSubmitting] = useState("");
  const autoLoginAttemptedRef = useRef(false);
  const loginPath = useMemo(
    () => buildLocalizedPath("/signin/loginView", "/en/signin/loginView"),
    [en]
  );
  const externalAuthState = useAsyncValue(fetchExternalAuthMethods, [en], {
    initialValue: []
  });
  const externalAuthMethods = externalAuthState.value || [];

  function buildLoginPath(nextEnglish: boolean, nextTab: "domestic" | "overseas") {
    const basePath = nextEnglish ? "/en/signin/loginView" : "/signin/loginView";
    return nextTab === "overseas" ? `${basePath}?tab=overseas` : basePath;
  }

  function changeLanguage(nextEnglish: boolean) {
    window.location.href = buildLoginPath(nextEnglish, tab);
  }

  function changeMembershipTab(nextTab: "domestic" | "overseas") {
    const nextPath = buildLoginPath(en, nextTab);
    setTab(nextTab);
    if (`${window.location.pathname}${window.location.search}` !== nextPath) {
      window.location.href = nextPath;
      return;
    }
    replace(nextPath);
  }

  useEffect(() => {
    const nextPath = tab === "overseas" ? `${loginPath}?tab=overseas` : loginPath;
    if (`${window.location.pathname}${window.location.search}` !== nextPath) {
      replace(nextPath);
    }
  }, [loginPath, tab]);

  useEffect(() => {
    const savedId = getCookie("userInputId");
    if (savedId) {
      setUserId(savedId);
      setSaveId(true);
    }
    if (getCookie("autoLoginFlag") === "true" && savedId) {
      setAutoLogin(true);
    }
  }, []);

  useEffect(() => {
    if (!autoLogin || !userId || !userPw || autoLoginAttemptedRef.current) {
      return;
    }
    autoLoginAttemptedRef.current = true;
    void submitLogin(userId, userPw, saveId, true);
  }, [autoLogin, saveId, userId, userPw]);

  useEffect(() => {
    const syncTab = () => setTab(resolveLoginTabFromLocation());
    syncTab();
    window.addEventListener("popstate", syncTab);
    window.addEventListener(getNavigationEventName(), syncTab);
    return () => {
      window.removeEventListener("popstate", syncTab);
      window.removeEventListener(getNavigationEventName(), syncTab);
    };
  }, []);

  const tabMeta = useMemo(() => {
    if (tab === "overseas") {
      return {
        joinPath: buildLocalizedPath("/join/step1", "/join/en/step1"),
        findIdPath: buildLocalizedPath("/signin/findId/overseas", "/en/signin/findId/overseas"),
        findPasswordPath: buildLocalizedPath("/signin/findPassword/overseas", "/en/signin/findPassword/overseas")
      };
    }
    return {
      joinPath: buildLocalizedPath("/join/step1", "/join/en/step1"),
      findIdPath: buildLocalizedPath("/signin/findId", "/en/signin/findId"),
      findPasswordPath: buildLocalizedPath("/signin/findPassword", "/en/signin/findPassword")
    };
  }, [tab]);

  useEffect(() => {
    logGovernanceScope("PAGE", "public-login", {
      language: en ? "en" : "ko",
      tab,
      saveId,
      autoLogin,
      submitting
    });
    logGovernanceScope("COMPONENT", "public-login-tabs", {
      tab,
      overseasPath: isOverseasPath(),
      joinPath: tabMeta.joinPath,
      findIdPath: tabMeta.findIdPath,
      findPasswordPath: tabMeta.findPasswordPath
    });
  }, [autoLogin, en, saveId, submitting, tab, tabMeta.findIdPath, tabMeta.findPasswordPath, tabMeta.joinPath]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    logGovernanceScope("ACTION", "public-login-submit", {
      tab,
      userId: userId.trim(),
      saveId,
      autoLogin
    });
    await submitLogin(userId, userPw, saveId, autoLogin);
  }

  async function submitLogin(nextUserId: string, nextUserPw: string, nextSaveId: boolean, nextAutoLogin: boolean) {
    logGovernanceScope("ACTION", "public-login-authenticate", {
      tab,
      userId: nextUserId.trim(),
      saveId: nextSaveId,
      autoLogin: nextAutoLogin
    });
    if (!nextUserId.trim()) {
      window.alert(en ? "Please enter your ID" : "아이디를 입력하세요");
      return;
    }
    if (!nextUserPw) {
      window.alert(en ? "Please enter your password" : "비밀번호를 입력하세요");
      return;
    }
    setSubmitting(true);
    try {
      const body = await postJsonWithSession<LoginResponse>(buildLocalizedPath("/signin/actionLogin", "/en/signin/actionLogin"), {
        userId: nextUserId.trim(),
        userPw: nextUserPw,
        userSe: "ENT",
        autoLogin: nextAutoLogin
      });
      if (body.status === "loginFailure") {
        window.alert(body.errors || (en ? "Login failed." : "로그인에 실패했습니다."));
        return;
      }

      if (nextSaveId) {
        setCookie("userInputId", nextUserId.trim(), 7);
      } else {
        deleteCookie("userInputId");
      }
      if (nextAutoLogin) {
        setCookie("autoLoginFlag", "true", 7);
      } else {
        deleteCookie("autoLoginFlag");
      }

      invalidateFrontendSessionCache();
      window.sessionStorage.setItem("loginUserId", body.userId || nextUserId.trim());
      window.sessionStorage.setItem("loginUserSe", body.userSe || "ENT");
      navigate(body.certified === false
        ? buildLocalizedPath("/signin/authChoice", "/en/signin/authChoice")
        : buildLocalizedPath("/home", "/en/home"));
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "로그인 요청 중 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleExternalAuth(methodCode: string) {
    setExternalAuthSubmitting(methodCode);
    try {
      const started = await startExternalAuth(methodCode);
      if (!started.txId) {
        throw new Error(started.message || (en ? "Failed to start authentication." : "인증 시작에 실패했습니다."));
      }
      if (started.nextAction === "COMPLETE") {
        const completed = await completeExternalAuth(methodCode, started.txId);
        if (completed.status !== "loginSuccess") {
          throw new Error(completed.errors || (en ? "External authentication failed." : "외부 인증에 실패했습니다."));
        }
        invalidateFrontendSessionCache();
        window.sessionStorage.setItem("loginUserId", completed.userId || "");
        window.sessionStorage.setItem("loginUserSe", completed.userSe || "ENT");
        navigate(completed.certified === false
          ? buildLocalizedPath("/signin/authChoice", "/en/signin/authChoice")
          : buildLocalizedPath("/home", "/en/home"));
        return;
      }

      if (started.urlScheme) {
        window.alert(started.message || (en
          ? "The external authentication channel is ready. Complete the vendor flow and then call the completion API."
          : "외부 인증 채널이 준비되었습니다. 벤더 인증 완료 후 completion API를 호출하도록 연결해 주세요."));
        if (/^https?:\/\//i.test(started.urlScheme)) {
          window.location.href = started.urlScheme;
        }
        return;
      }

      throw new Error(started.message || (en ? "No external authentication route was returned." : "인증 경로가 반환되지 않았습니다."));
    } catch (error) {
      window.alert(error instanceof Error ? error.message : (en ? "External authentication request failed." : "외부 인증 요청에 실패했습니다."));
    } finally {
      setExternalAuthSubmitting("");
    }
  }

  return (
    <div className="bg-[var(--kr-gov-bg-gray)] text-[var(--kr-gov-text-primary)] min-h-screen flex flex-col">
      <AppLinkButton className="absolute -top-full left-0 z-[100] !min-h-0 !border-0 !bg-[var(--kr-gov-blue)] !p-3 !text-white transition-all focus:top-0 focus:outline-none focus:ring-2 focus:ring-white hover:!bg-[var(--kr-gov-blue)]" href="#main-content" variant="ghost">
        {en ? "Skip to main content" : "본문 바로가기"}
      </AppLinkButton>
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
              <AppLinkButton className="!min-h-0 !border-0 !bg-transparent !p-0 !text-inherit hover:!bg-transparent flex items-center gap-2" href={buildLocalizedPath("/home", "/en/home")} variant="ghost">
                <span className="material-symbols-outlined text-[32px] text-[var(--kr-gov-blue)]" style={{ fontVariationSettings: "'wght' 600" }}>
                  eco
                </span>
                <div className="flex flex-col">
                  <h1 className={`text-xl font-bold tracking-tight text-[var(--kr-gov-text-primary)]${en ? " uppercase" : ""}`}>
                    {en ? "CCUS Portal" : "CCUS 통합관리 포털"}
                  </h1>
                  <p className="text-[10px] text-[var(--kr-gov-text-secondary)] font-bold uppercase tracking-wider">
                    Carbon Capture, Utilization and Storage
                  </p>
                </div>
              </AppLinkButton>
            </div>
            <div className="flex items-center gap-6">
              <div className="hidden sm:flex items-center gap-1.5 text-xs font-bold text-emerald-600 px-3 py-1.5 bg-emerald-50 rounded-full border border-emerald-100">
                <span className="material-symbols-outlined text-[16px]">lock</span>
                {en ? "Secure SSL Communication Active" : "안전한 SSL 보안 통신 중"}
              </div>
              <div className="flex border border-[var(--kr-gov-border-light)] rounded-[var(--kr-gov-radius)] overflow-hidden">
                <AppButton
                  className={`px-3 py-1 text-xs font-bold ${en ? "!bg-white !text-[var(--kr-gov-text-secondary)] hover:!bg-gray-100" : "!bg-[var(--kr-gov-blue)] !text-white hover:!bg-[var(--kr-gov-blue-hover)]"}`}
                  onClick={() => changeLanguage(false)}
                  size="xs"
                  type="button"
                  variant="ghost"
                >
                  KO
                </AppButton>
                <AppButton
                  className={`px-3 py-1 text-xs font-bold border-l border-[var(--kr-gov-border-light)] ${en ? "!bg-[var(--kr-gov-blue)] !text-white hover:!bg-[var(--kr-gov-blue-hover)]" : "!bg-white !text-[var(--kr-gov-text-secondary)] hover:!bg-gray-100"}`}
                  onClick={() => changeLanguage(true)}
                  size="xs"
                  type="button"
                  variant="ghost"
                >
                  EN
                </AppButton>
              </div>
            </div>
          </div>
        </div>
      </header>
      <main className="flex-grow flex flex-col items-center justify-center py-12 px-4" id="main-content">
        <div className="w-full max-w-[480px] mb-6" data-help-id="signin-login-notice">
          <div className="bg-blue-50 border border-blue-100 p-4 rounded-[var(--kr-gov-radius)] flex gap-3">
            <span className="material-symbols-outlined text-blue-600">info</span>
            <div className="text-sm text-blue-800 leading-relaxed">
              <p className="font-bold mb-0.5">{en ? "System Maintenance Notice" : "시스템 점검 안내"}</p>
              <p>
                {en
                  ? "Regular maintenance is scheduled for 2025.08.20 (Wed) 02:00 ~ 05:00 KST to ensure stable service delivery."
                  : "2025.08.20(수) 02:00 ~ 05:00 안정적인 서비스 제공을 위한 정기 점검이 예정되어 있습니다."}
              </p>
            </div>
          </div>
        </div>
        <div className="w-full max-w-[480px] bg-white border border-[var(--kr-gov-border-light)] rounded-lg shadow-sm overflow-hidden">
          <div className="flex border-b border-[var(--kr-gov-border-light)] bg-gray-50" aria-label={en ? "Member type" : "회원 유형 선택"} role="tablist" data-help-id="signin-login-tabs">
            <AppButton
              aria-selected={tab === "domestic"}
              className={`flex-1 py-5 text-[16px] flex items-center justify-center gap-2 ${tab === "domestic" ? "tab-active" : "tab-inactive"}`}
              onClick={() => changeMembershipTab("domestic")}
              role="tab"
              size="lg"
              tabIndex={tab === "domestic" ? 0 : -1}
              type="button"
              variant="ghost"
            >
              {en ? "Domestic Enterprise" : "국내 기업 회원"}
            </AppButton>
            <AppButton
              aria-selected={tab === "overseas"}
              className={`flex-1 py-5 text-[16px] flex items-center justify-center gap-2 ${tab === "overseas" ? "tab-active" : "tab-inactive"}`}
              onClick={() => changeMembershipTab("overseas")}
              role="tab"
              size="lg"
              tabIndex={tab === "overseas" ? 0 : -1}
              type="button"
              variant="ghost"
            >
              {en ? "Overseas Enterprise" : "해외 기업 회원"}
            </AppButton>
          </div>
          <div className="p-8 lg:p-10" data-help-id="signin-login-form">
            <form className="space-y-6" id="loginForm" name="loginForm" onSubmit={handleSubmit}>
              <div className="space-y-4">
                <div className="relative">
                  <label className="block text-sm font-bold text-[var(--kr-gov-text-secondary)] mb-1.5" htmlFor="userId">
                    {en ? "ID" : "아이디"}
                  </label>
                  <AppInput
                    autoComplete="username"
                    className="h-14"
                    id="userId"
                    name="userId"
                    onChange={(event) => setUserId(event.target.value)}
                    placeholder={en ? "Enter your ID" : "아이디를 입력하세요"}
                    spellCheck={false}
                    type="text"
                    value={userId}
                  />
                </div>
                <div className="relative">
                  <label className="block text-sm font-bold text-[var(--kr-gov-text-secondary)] mb-1.5" htmlFor="userPw">
                    {en ? "Password" : "비밀번호"}
                  </label>
                  <AppInput
                    autoComplete="current-password"
                    className="h-14"
                    id="userPw"
                    name="userPw"
                    onChange={(event) => setUserPw(event.target.value)}
                    placeholder={en ? "Enter your password" : "비밀번호를 입력하세요"}
                    type="password"
                    value={userPw}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <label className="inline-flex items-center cursor-pointer">
                    <AppCheckbox
                      checked={saveId}
                      className="w-5"
                      id="saveId"
                      onChange={(event) => setSaveId(event.target.checked)}
                    />
                    <span className="ml-2 text-sm text-[var(--kr-gov-text-secondary)]">{en ? "Remember ID" : "아이디 저장"}</span>
                  </label>
                  <label className="inline-flex items-center cursor-pointer">
                    <AppCheckbox
                      checked={autoLogin}
                      className="w-5"
                      id="autoLogin"
                      onChange={(event) => setAutoLogin(event.target.checked)}
                    />
                    <span className="ml-2 text-sm text-[var(--kr-gov-text-secondary)]">{en ? "Auto Login" : "자동 로그인"}</span>
                  </label>
                </div>
              </div>
              <AppButton
                className="w-full h-14 text-lg"
                disabled={submitting}
                size="lg"
                type="submit"
                variant="primary"
              >
                {en ? "Log In" : "로그인"}
              </AppButton>
              <div className="flex items-center justify-center gap-4 text-sm text-[var(--kr-gov-text-secondary)] font-medium pt-2">
                <AppLinkButton className="min-h-0 border-0 bg-transparent px-0 py-0 hover:bg-transparent hover:underline" href={tabMeta.findIdPath} id="findIdLink" variant="ghost">
                  {en ? "Find ID" : "아이디 찾기"}
                </AppLinkButton>
                <span className="w-px h-3 bg-[var(--kr-gov-border-light)]"></span>
                <AppLinkButton className="min-h-0 border-0 bg-transparent px-0 py-0 hover:bg-transparent hover:underline" href={tabMeta.findPasswordPath} id="findPasswordLink" variant="ghost">
                  {en ? "Reset Password" : "비밀번호 재설정"}
                </AppLinkButton>
                <span className="w-px h-3 bg-[var(--kr-gov-border-light)]"></span>
                <AppLinkButton className="min-h-0 border-0 bg-transparent px-0 py-0 font-bold text-[var(--kr-gov-blue)] hover:bg-transparent hover:underline" href={tabMeta.joinPath} id="joinLink" variant="ghost">
                  {en ? "Register" : "회원가입"}
                </AppLinkButton>
              </div>
              <div className="relative py-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200"></div>
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="px-2 bg-white text-gray-400 font-bold uppercase tracking-wider">
                    {en ? "Or Simple Authentication Login" : "또는 간편인증 로그인"}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3" data-help-id="signin-login-simple-auth">
                {externalAuthMethods.length > 0 ? (
                  <>
                    {externalAuthMethods[0] ? (
                      <AppButton
                        className="w-full h-12 text-sm"
                        disabled={!externalAuthMethods[0].available || !!externalAuthSubmitting}
                        onClick={() => void handleExternalAuth(externalAuthMethods[0].methodCode)}
                        type="button"
                      >
                        <span className="material-symbols-outlined text-blue-700">{externalAuthMethods[0].icon || "verified_user"}</span>
                        {externalAuthSubmitting === externalAuthMethods[0].methodCode
                          ? (en ? "Processing..." : "처리 중...")
                          : externalAuthMethods[0].displayName}
                      </AppButton>
                    ) : null}
                    <div className="grid grid-cols-2 gap-3">
                      {externalAuthMethods.slice(1, 3).map((method) => (
                        <AppButton
                          className="h-12 text-sm"
                          disabled={!method.available || !!externalAuthSubmitting}
                          key={`${method.providerCode}-${method.methodCode}`}
                          onClick={() => void handleExternalAuth(method.methodCode)}
                          type="button"
                        >
                          <span className="material-symbols-outlined text-gray-600">{method.icon || "verified_user"}</span>
                          {externalAuthSubmitting === method.methodCode
                            ? (en ? "Processing..." : "처리 중...")
                            : method.displayName}
                        </AppButton>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="rounded-[var(--kr-gov-radius)] border border-dashed border-[var(--kr-gov-border-light)] px-4 py-5 text-sm text-[var(--kr-gov-text-secondary)]">
                    {externalAuthState.loading
                      ? (en ? "Loading authentication methods..." : "인증 수단을 불러오는 중입니다...")
                      : (externalAuthState.error || (en ? "No external authentication methods are configured." : "설정된 외부 인증 수단이 없습니다."))}
                  </div>
                )}
              </div>
            </form>
          </div>
        </div>
        <p className="mt-10 text-sm text-[var(--kr-gov-text-secondary)] text-center max-w-md leading-relaxed">
          {en
            ? "This system is restricted to authorized users only."
            : "본 시스템은 인가된 사용자만 이용 가능합니다."}
          <br />
          {en
            ? "Unauthorized access attempts may be punishable by law."
            : "불법적인 접근 시 관계 법령에 의해 처벌받을 수 있습니다."}
        </p>
      </main>
      <footer className="bg-white border-t border-[var(--kr-gov-border-light)]">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 py-10">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <img
                  alt={en ? "Government of Korea Emblem" : "대한민국 정부 상징"}
                  className="h-8 grayscale"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuBUw404pm2QFmL61j73Dpfn72GnHGEg-KXTkLQ8WVJYUJ4iekrO0IvqJK8cd0cOSNSIh9Yq1LAodkSNj7oHtVAltdnnymj25ZzOI3l167qrrWmkEoYsZGu3ztT-YGo9se-fFR3NhBG3rZ8DYfs2vna0bxSzVG8VjryTnsz40LCDS2SN3-AeqXrbaPEva2ptmrQzO8iQSwbqSGyGKddlGf7FtnhHT25Cz5a5Xhk8MTve0BF4RWxN-ULiw64ZBbrTASIHQUaURqiZXyE"
                />
                <span className="text-xl font-black text-[var(--kr-gov-text-primary)]">
                  {en ? "Carbon Neutral CCUS Management Headquarters" : "탄소중립 CCUS 통합관리본부"}
                </span>
              </div>
              <address className="not-italic text-sm text-[var(--kr-gov-text-secondary)] leading-relaxed">
                {en
                  ? "(04551) 110 Sejong-daero, Jung-gu, Seoul, Republic of Korea | Representative: 02-1234-5678"
                  : "(04551) 서울특별시 중구 세종대로 110 | 대표전화: 02-1234-5678"}
                <br />
                © 2025 CCUS Integration Management Portal. All rights reserved.
              </address>
            </div>
            <div className="flex flex-col items-end gap-4">
              <div className="flex flex-wrap gap-6 text-sm font-bold">
                <AppLinkButton className="!min-h-0 !border-0 !bg-transparent !p-0 !text-[var(--kr-gov-blue)] hover:underline hover:!bg-transparent" href="#" variant="ghost">{en ? "Privacy Policy" : "개인정보처리방침"}</AppLinkButton>
                <AppLinkButton className="!min-h-0 !border-0 !bg-transparent !p-0 !text-[var(--kr-gov-text-primary)] hover:underline hover:!bg-transparent" href="#" variant="ghost">{en ? "Terms of Use" : "이용약관"}</AppLinkButton>
              </div>
              <div className="flex items-center gap-4">
                <div className="px-3 py-1 bg-[var(--kr-gov-bg-gray)] rounded-[var(--kr-gov-radius)] text-[11px] font-bold text-[var(--kr-gov-text-secondary)]">
                  {en ? "Last Updated:" : "최종 수정일:"} <time dateTime="2025-08-14">2025.08.14</time>
                </div>
                <img
                  alt={en ? "Web Accessibility Quality Certification Mark" : "웹 접근성 품질인증 마크"}
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

function getCookie(cookieName: string) {
  const prefix = `${cookieName}=`;
  const cookies = document.cookie.split(";").map((value) => value.trim());
  const matched = cookies.find((value) => value.startsWith(prefix));
  return matched ? decodeURIComponent(matched.slice(prefix.length)) : "";
}

function setCookie(cookieName: string, value: string, days: number) {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + days);
  document.cookie = `${cookieName}=${encodeURIComponent(value)}; expires=${expiresAt.toUTCString()}; path=/`;
}

function deleteCookie(cookieName: string) {
  document.cookie = `${cookieName}=; expires=${new Date(0).toUTCString()}; path=/`;
}

export function AuthChoicePage() {
  const en = isEnglish();
  const [saving, setSaving] = useState("");
  const methodsState = useAsyncValue(fetchExternalAuthMethods, [en], {
    initialValue: []
  });
  const methods = methodsState.value || [];

  async function handleAuthChoice(authTy: string) {
    setSaving(authTy);
    try {
      const storedUserId = window.sessionStorage.getItem("loginUserId") || "";
      const storedUserSe = window.sessionStorage.getItem("loginUserSe") || "ENT";
      const started = await startExternalAuth(authTy, storedUserId, storedUserSe);
      if (!started.txId) {
        throw new Error(started.message || (en ? "Failed to start authentication." : "인증 시작에 실패했습니다."));
      }
      const body = await completeExternalAuth(authTy, started.txId, storedUserId, storedUserSe);
      if (body.status !== "loginSuccess") {
        throw new Error(body.errors || (en ? "Failed to save authentication info." : "인증 정보 저장에 실패했습니다."));
      }
      invalidateFrontendSessionCache();
      navigate(buildLocalizedPath("/home", "/en/home"));
    } catch (error) {
      window.alert(error instanceof Error ? error.message : (en ? "An error occurred while processing authentication." : "인증 처리 중 오류가 발생했습니다."));
    } finally {
      setSaving("");
    }
  }

  return (
    <PublicFrame
      title={en ? "Select Authentication Method" : "인증 수단 선택"}
      subtitle={en ? "Please select your preferred authentication method for convenient and secure access." : "편리하고 안전한 이용을 위해 원하시는 인증 수단을 선택해 주세요."}
      languagePathKo="/signin/authChoice"
      languagePathEn="/en/signin/authChoice"
      footerNote={
        <>
          <button
            className="px-10 h-12 border border-[var(--kr-gov-border-light)] text-[var(--kr-gov-text-secondary)] font-bold rounded-[var(--kr-gov-radius)] hover:bg-gray-50 transition-colors focus-visible"
            onClick={() => window.history.back()}
            type="button"
          >
            {en ? "Cancel" : "취소"}
          </button>
          <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 px-3 py-1.5 bg-emerald-50 rounded-full border border-emerald-100">
            <span className="material-symbols-outlined text-[14px]">shield</span>
            {en ? "The security module is operating safely" : "보안 모듈이 안전하게 작동 중입니다"}
          </div>
        </>
      }
    >
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6" data-help-id="signin-auth-choice-options">
        {methods.length > 0 ? methods.map((method) => (
          <button
            className={`flex flex-col items-center p-8 bg-white border border-[var(--kr-gov-border-light)] rounded-lg transition-all hover:border-[var(--kr-gov-blue)] hover:shadow-md focus-visible text-center w-full ${method.available ? "" : "opacity-60"}`}
            disabled={!!saving || !method.available}
            key={`${method.providerCode}-${method.methodCode}`}
            onClick={() => void handleAuthChoice(method.methodCode)}
            type="button"
          >
            <div className="w-12 h-12 flex items-center justify-center bg-gray-50 text-[var(--kr-gov-blue)] rounded-[5px] mb-4 border border-gray-100">
              <span className="material-symbols-outlined">{method.icon || "verified_user"}</span>
            </div>
            <h3 className="text-lg font-bold mb-3">{method.displayName}</h3>
            <p className="text-sm text-[var(--kr-gov-text-secondary)] leading-relaxed">{method.description}</p>
            <span className="mt-4 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">
              {saving === method.methodCode ? (en ? "Processing" : "진행중") : (method.statusMessage || method.status)}
            </span>
          </button>
        )) : (
          <div className="md:col-span-3 rounded-[var(--kr-gov-radius)] border border-dashed border-[var(--kr-gov-border-light)] bg-white px-5 py-8 text-center text-sm text-[var(--kr-gov-text-secondary)]">
            {methodsState.loading
              ? (en ? "Loading authentication methods..." : "인증 수단을 불러오는 중입니다...")
              : (methodsState.error || (en ? "No authentication methods are available." : "사용 가능한 인증 수단이 없습니다."))}
          </div>
        )}
      </section>
    </PublicFrame>
  );
}

type PublicTab = "domestic" | "overseas";

type FindIdResultPayload = {
  found: boolean;
  maskedId: string;
  passwordResetUrl: string;
  tab: PublicTab;
};

function getPublicTab(): PublicTab {
  return getSearchParam("tab") === "overseas" || isOverseasPath() ? "overseas" : "domestic";
}

function getLanguageRoute(koPath: string, enPath: string) {
  return isEnglish() ? enPath : koPath;
}

function PublicAuthShell(props: {
  languagePathKo: string;
  languagePathEn: string;
  children: ReactNode;
}) {
  const en = isEnglish();

  return (
    <div className="bg-[var(--kr-gov-bg-gray)] text-[var(--kr-gov-text-primary)] min-h-screen flex flex-col">
      <AppLinkButton className="skip-link !min-h-0 !border-0 !bg-[var(--kr-gov-blue)] !p-3 !text-white hover:!bg-[var(--kr-gov-blue)]" href="#main-content" variant="ghost">{en ? "Skip to main content" : "본문 바로가기"}</AppLinkButton>
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
              <AppLinkButton className="!min-h-0 !border-0 !bg-transparent !p-0 !text-inherit hover:!bg-transparent flex items-center gap-2" href={buildLocalizedPath("/home", "/en/home")} variant="ghost">
                <span className="material-symbols-outlined text-[32px] text-[var(--kr-gov-blue)]" style={{ fontVariationSettings: "'wght' 600" }}>eco</span>
                <div className="flex flex-col">
                  <h1 className={`text-xl font-bold tracking-tight text-[var(--kr-gov-text-primary)] ${en ? "uppercase" : ""}`}>
                    {en ? "CCUS Portal" : "CCUS 통합관리 포털"}
                  </h1>
                  <p className="text-[10px] text-[var(--kr-gov-text-secondary)] font-bold uppercase tracking-wider">Carbon Capture, Utilization and Storage</p>
                </div>
              </AppLinkButton>
            </div>
            <div className="flex items-center gap-6">
              <div className="hidden sm:flex items-center gap-1.5 text-xs font-bold text-emerald-600 px-3 py-1.5 bg-emerald-50 rounded-full border border-emerald-100">
                <span className="material-symbols-outlined text-[16px]">lock</span>
                {en ? "Secure SSL Communication Active" : "안전한 SSL 보안 통신 중"}
              </div>
              <div className="flex border border-[var(--kr-gov-border-light)] rounded-[var(--kr-gov-radius)] overflow-hidden">
                <AppLinkButton className={`px-3 py-1 text-xs font-bold ${en ? "!bg-white !text-[var(--kr-gov-text-secondary)] hover:!bg-gray-100" : "!bg-[var(--kr-gov-blue)] !text-white"}`} href={props.languagePathKo} size="xs" variant="ghost">KO</AppLinkButton>
                <AppLinkButton className={`px-3 py-1 text-xs font-bold border-l border-[var(--kr-gov-border-light)] ${en ? "!bg-[var(--kr-gov-blue)] !text-white" : "!bg-white !text-[var(--kr-gov-text-secondary)] hover:!bg-gray-100"}`} href={props.languagePathEn} size="xs" variant="ghost">EN</AppLinkButton>
              </div>
            </div>
          </div>
        </div>
      </header>
      {props.children}
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
                {en
                  ? "(04551) 110 Sejong-daero, Jung-gu, Seoul | Main Tel: 02-1234-5678"
                  : "(04551) 서울특별시 중구 세종대로 110 | 대표전화: 02-1234-5678"}
                <br />
                © 2025 CCUS Integration Management Portal. All rights reserved.
              </address>
            </div>
            <div className="flex flex-col items-end gap-4">
              <div className="flex flex-wrap gap-6 text-sm font-bold">
                <AppLinkButton className="!min-h-0 !border-0 !bg-transparent !p-0 !text-[var(--kr-gov-blue)] hover:underline hover:!bg-transparent" href="#" variant="ghost">{en ? "Privacy Policy" : "개인정보처리방침"}</AppLinkButton>
                <AppLinkButton className="!min-h-0 !border-0 !bg-transparent !p-0 !text-[var(--kr-gov-text-primary)] hover:underline hover:!bg-transparent" href="#" variant="ghost">{en ? "Terms of Service" : "이용약관"}</AppLinkButton>
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

function FindIdTabs({ tab }: { tab: PublicTab }) {
  const en = isEnglish();

  return (
    <div className="flex bg-gray-50">
      <AppLinkButton
        className={`flex-1 py-5 text-[16px] flex items-center justify-center gap-2 ${tab === "domestic" ? "tab-active" : "tab-inactive"}`}
        href={buildLocalizedPath("/signin/findId", "/en/signin/findId")}
        size="lg"
        variant="ghost"
      >
        <span className="material-symbols-outlined">person_check</span>
        {en ? "Domestic User" : "국내 사용자"}
      </AppLinkButton>
      <AppLinkButton
        className={`flex-1 py-5 text-[16px] flex items-center justify-center gap-2 ${tab === "overseas" ? "tab-active" : "tab-inactive"}`}
        href={buildLocalizedPath("/signin/findId/overseas", "/en/signin/findId/overseas")}
        size="lg"
        variant="ghost"
      >
        <span className="material-symbols-outlined">mail</span>
        {en ? "Overseas User" : "해외 사용자"}
      </AppLinkButton>
    </div>
  );
}

function PasswordLevel(props: { password: string; en: boolean }) {
  const password = props.password.trim();
  const categoryCount = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].reduce((count, regex) => count + (regex.test(password) ? 1 : 0), 0);
  const valid = password.length >= 9 && categoryCount >= 3;
  const strong = valid && [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].every((regex) => regex.test(password));

  const width = !password ? "0%" : strong ? "100%" : valid ? "66%" : "33%";
  const barClass = !password ? "bg-[var(--kr-gov-error)]" : strong ? "bg-[var(--kr-gov-success)]" : valid ? "bg-amber-500" : "bg-[var(--kr-gov-error)]";
  const label = !password
    ? (props.en ? "Weak" : "취약")
    : strong
      ? (props.en ? "Strong" : "강함")
      : valid
        ? (props.en ? "Medium" : "보통")
        : (props.en ? "Weak" : "취약");
  const labelClass = !password || !valid
    ? "text-[var(--kr-gov-error)]"
    : strong
      ? "text-[var(--kr-gov-success)]"
      : "text-amber-600";

  return (
    <div className="mt-2 flex items-center gap-2">
      <div className="flex-grow h-1 bg-gray-200 rounded-full overflow-hidden">
        <div className={`h-full ${barClass}`} style={{ width }}></div>
      </div>
      <span className={`text-xs font-bold ${labelClass}`}>{label}</span>
    </div>
  );
}

export function FindIdPage() {
  const en = isEnglish();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [sentCode, setSentCode] = useState("");
  const tab = getPublicTab();

  function handleSendCode() {
    if (!email.trim()) {
      window.alert(en ? "Please enter your email address." : "이메일 주소를 입력해 주세요.");
      return;
    }
    const nextCode = String(Math.floor(Math.random() * 1000000)).padStart(6, "0");
    setSentCode(nextCode);
    setVerificationCode("");
    window.alert(`${en ? "Verification code: " : "인증번호: "}${nextCode}`);
  }

  function handleSubmit() {
    if (!name.trim() || !email.trim()) {
      window.alert(en ? "Please enter your name and email." : "성명과 이메일을 입력해 주세요.");
      return;
    }
    if (tab === "overseas") {
      if (!sentCode) {
        window.alert(en ? "Please send the verification code first." : "먼저 인증번호를 발송해 주세요.");
        return;
      }
      if (!verificationCode.trim()) {
        window.alert(en ? "Please enter the verification code." : "인증번호를 입력해 주세요.");
        return;
      }
      if (verificationCode.trim() !== sentCode) {
        window.alert(en ? "The verification code does not match." : "인증번호가 일치하지 않습니다.");
        return;
      }
    }
    const search = new URLSearchParams({ applcntNm: name.trim(), email: email.trim(), tab });
    navigate(`${buildLocalizedPath("/signin/findId/result", "/en/signin/findId/result")}?${search.toString()}`);
  }

  return (
    <PublicAuthShell
      languagePathKo={tab === "overseas" ? "/signin/findId/overseas" : "/signin/findId"}
      languagePathEn={tab === "overseas" ? "/en/signin/findId/overseas" : "/en/signin/findId"}
    >
      <main className="flex-grow flex flex-col items-center py-16 px-4" id="main-content">
        <div className="w-full max-w-[640px] text-center mb-10">
          <h2 className="text-3xl font-black text-[var(--kr-gov-text-primary)] mb-4">{en ? "Find ID" : "아이디 찾기"}</h2>
          <p className="text-[var(--kr-gov-text-secondary)] text-lg">
            {en ? "You can find your ID using the information registered during membership sign-up." : "회원가입 시 등록한 정보를 통해 아이디를 찾으실 수 있습니다."}
          </p>
        </div>

        <div className="w-full max-w-[640px] bg-white border border-[var(--kr-gov-border-light)] rounded-lg shadow-sm overflow-hidden">
          <FindIdTabs tab={tab} />
          <div className="p-8 lg:p-12">
            <div className="space-y-8" data-help-id="signin-find-id-form">
              <div className={tab === "overseas" ? "space-y-5" : "space-y-6"}>
                <div>
                  <label className="block text-sm font-bold text-[var(--kr-gov-text-secondary)] mb-2" htmlFor="user-name">{en ? "Name" : "성명"}</label>
                  <AppInput className="h-14 public-field public-field--auth" id="user-name" onChange={(event) => setName(event.target.value)} placeholder={en ? "Enter your full name" : "성명을 입력하세요"} type="text" value={name} />
                </div>
                <div>
                  <label className="block text-sm font-bold text-[var(--kr-gov-text-secondary)] mb-2" htmlFor="user-email">{en ? "Email Address" : "이메일 주소"}</label>
                  <div className="flex gap-2">
                    <AppInput className="flex-grow h-14 public-field public-field--auth" id="user-email" onChange={(event) => setEmail(event.target.value)} placeholder="example@institution.go.kr" type="text" inputMode="email" value={email} />
                    <AppButton className="px-6 h-14 whitespace-nowrap" onClick={handleSendCode} type="button">
                      {en ? "Send Verification Code" : "인증번호 발송"}
                    </AppButton>
                  </div>
                  <p className="mt-2 text-xs text-blue-600 font-medium">
                    {en ? "* For overseas users, official institutional email verification is required." : "* 해외 사업자의 경우 공식 기관 이메일 인증이 필요합니다."}
                  </p>
                </div>
                {tab === "overseas" ? (
                  <div>
                    <label className="block text-sm font-bold text-[var(--kr-gov-text-secondary)] mb-2" htmlFor="auth-code">{en ? "Verification Code" : "인증번호"}</label>
                    <AppInput
                      className="h-14 public-field public-field--auth"
                      id="auth-code"
                      inputMode="numeric"
                      maxLength={6}
                      onChange={(event) => setVerificationCode(event.target.value)}
                      placeholder={en ? "Enter the 6-digit verification code" : "인증번호 6자리를 입력하세요"}
                      type="text"
                      value={verificationCode}
                    />
                  </div>
                ) : (
                  <div className="space-y-4 pt-4" data-help-id="signin-find-id-methods">
                    <p className="text-sm font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Select Verification Method" : "본인인증 수단 선택"}</p>
                    {[
                      {
                        icon: "smartphone",
                        title: en ? "Mobile Verification" : "휴대폰 본인인증",
                        description: en ? "Verify via mobile phone registered in your name" : "본인 명의의 휴대폰으로 본인인증 진행"
                      },
                      {
                        icon: "verified_user",
                        title: en ? "Joint / Financial Certificate" : "공동인증서/금융인증서",
                        description: en ? "Verify securely using your registered certificates" : "등록된 인증서를 통해 안전하게 본인확인"
                      },
                      {
                        icon: "admin_panel_settings",
                        title: en ? "I-PIN Verification" : "아이핀 인증",
                        description: en ? "Verify identity safely online using I-PIN" : "아이핀을 통해 온라인으로 안전하게 본인확인"
                      },
                      {
                        icon: "fingerprint",
                        title: en ? "Digital One Pass" : "디지털원패스",
                        description: en ? "Convenient and secure identity verification with one account" : "하나의 계정으로 편리하고 안전하게 본인확인"
                      }
                    ].map((method) => (
                      <div className="flex items-center justify-between p-6 border border-[var(--kr-gov-border-light)] rounded-lg hover:border-[var(--kr-gov-blue)] transition-colors bg-white group" key={method.title}>
                        <div className="flex items-start gap-4">
                          <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                            <span className="material-symbols-outlined text-[var(--kr-gov-blue)]">{method.icon}</span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-base font-bold text-[var(--kr-gov-text-primary)]">{method.title}</span>
                            <span className="text-xs text-[var(--kr-gov-text-secondary)] mt-1">{method.description}</span>
                          </div>
                        </div>
                        <AppButton className="px-5 py-2.5 whitespace-nowrap text-sm" type="button">
                          {en ? "Select" : "선택"}
                        </AppButton>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <AppButton className="w-full h-16 text-xl" onClick={handleSubmit} size="lg" type="button" variant="primary">
                {en ? "Find ID" : "아이디 찾기"}
              </AppButton>
            </div>
          </div>
        </div>

        <div className="mt-12 text-center">
          <p className="text-sm text-[var(--kr-gov-text-secondary)] leading-relaxed">
            {en ? "Having trouble finding your ID?" : "아이디 찾기에 어려움이 있으신가요?"} <br />
            {en ? <>Please contact our Support Center at <span className="font-bold text-[var(--kr-gov-text-primary)]">02-1234-5678</span> or use <AppLinkButton className="min-h-0 border-0 bg-transparent px-0 py-0 underline font-bold text-[var(--kr-gov-blue)] hover:bg-transparent" href="#" variant="ghost">1:1 Inquiry</AppLinkButton>.</> : <>고객지원센터 <span className="font-bold text-[var(--kr-gov-text-primary)]">02-1234-5678</span> 또는 <AppLinkButton className="min-h-0 border-0 bg-transparent px-0 py-0 underline font-bold text-[var(--kr-gov-blue)] hover:bg-transparent" href="#" variant="ghost">1:1 문의</AppLinkButton>를 이용해 주세요.</>}
          </p>
        </div>
      </main>
    </PublicAuthShell>
  );
}

export function FindIdResultPage() {
  const en = isEnglish();
  const name = getSearchParam("applcntNm");
  const email = getSearchParam("email");
  const tab = getPublicTab();
  const resultState = useAsyncValue<FindIdResultPayload>(
    () => {
      const search = new URLSearchParams({ applcntNm: name, email, tab });
      return fetchJson<FindIdResultPayload>(
        `${buildLocalizedPath("/signin/api/findId/result", "/en/signin/api/findId/result")}?${search.toString()}`
      );
    },
    [name, email, tab, en],
    {
      initialValue: { found: false, maskedId: "-", passwordResetUrl: getLanguageRoute("/signin/findPassword", "/en/signin/findPassword"), tab },
      onError: () => undefined
    }
  );
  const result = resultState.value || { found: false, maskedId: "-", passwordResetUrl: getLanguageRoute("/signin/findPassword", "/en/signin/findPassword"), tab };
  const error = resultState.error ? (en ? "Failed to load the result." : "결과를 불러오지 못했습니다.") : "";

  return (
    <PublicAuthShell
      languagePathKo={`/signin/findId/result?${new URLSearchParams({ applcntNm: name, email, tab }).toString()}`}
      languagePathEn={`/en/signin/findId/result?${new URLSearchParams({ applcntNm: name, email, tab }).toString()}`}
    >
      <main className="flex-grow flex flex-col items-center py-16 px-4" id="main-content">
        <div className="w-full max-w-[560px] text-center mb-8">
          <h2 className="text-3xl font-black text-[var(--kr-gov-text-primary)] mb-4">{en ? "Find ID Result" : "아이디 찾기 결과"}</h2>
        </div>
        <div className="w-full max-w-[560px] bg-white border border-[var(--kr-gov-border-light)] rounded-lg shadow-sm p-10 lg:p-14 text-center" data-help-id="signin-find-id-result-card">
          <div className="mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-50 rounded-full mb-4">
              <span className="material-symbols-outlined text-4xl text-[var(--kr-gov-blue)]" style={{ fontVariationSettings: "'opsz' 48, 'wght' 600" }}>check_circle</span>
            </div>
            <p className="text-2xl font-bold text-[var(--kr-gov-text-primary)]">
              {result.found ? (en ? "Your ID has been found." : "아이디를 찾았습니다.") : (en ? "No matching account found." : "일치하는 계정을 찾을 수 없습니다.")}
            </p>
          </div>
          <div className="bg-gray-50 border border-[var(--kr-gov-border-light)] rounded-[var(--kr-gov-radius)] py-8 mb-4">
            <span className="text-3xl font-bold text-[var(--kr-gov-blue)] tracking-wide">{result.maskedId || "-"}</span>
          </div>
          <p className="text-sm text-[var(--kr-gov-text-secondary)] mb-10">
            {result.found
              ? (en ? "For security reasons, parts of your ID have been masked." : "보안을 위해 아이디의 일부를 마스킹 처리하였습니다.")
              : (en ? "Please verify your name and email and try again." : "성명과 이메일을 다시 확인해 주세요.")}
          </p>
          {error ? <p className="text-sm text-[var(--kr-gov-error)] mb-6">{error}</p> : null}
          <div className="flex flex-col gap-3" data-help-id="signin-find-id-result-actions">
            <AppLinkButton className="w-full h-14 text-lg" href={buildLocalizedPath("/signin/loginView", "/en/signin/loginView")} size="lg" variant="primary">
              {en ? "Log In" : "로그인하기"}
            </AppLinkButton>
            <AppLinkButton className="w-full h-14 text-lg" href={result.passwordResetUrl} size="lg" variant="secondary">
              {en ? "Reset Password" : "비밀번호 재설정"}
            </AppLinkButton>
          </div>
        </div>
        <div className="mt-12 text-center">
          <p className="text-sm text-[var(--kr-gov-text-secondary)] leading-relaxed">
            {en ? <>Still can't remember your ID? <br />Contact Support at <span className="font-bold text-[var(--kr-gov-text-primary)]">02-1234-5678</span> or use our <AppLinkButton className="!min-h-0 !border-0 !bg-transparent !p-0 !text-[var(--kr-gov-blue)] underline font-bold hover:!bg-transparent" href="#" variant="ghost">1:1 Inquiry</AppLinkButton>.</> : <>아이디가 기억나지 않으시나요? <br />고객지원센터 <span className="font-bold text-[var(--kr-gov-text-primary)]">02-1234-5678</span> 또는 <AppLinkButton className="!min-h-0 !border-0 !bg-transparent !p-0 !text-[var(--kr-gov-blue)] underline font-bold hover:!bg-transparent" href="#" variant="ghost">1:1 문의</AppLinkButton>를 이용해 주세요.</>}
          </p>
        </div>
      </main>
    </PublicAuthShell>
  );
}

export function FindPasswordPage() {
  const en = isEnglish();
  const [userId, setUserId] = useState("");
  const [email, setEmail] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [sentCode, setSentCode] = useState("");
  const [verified, setVerified] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const tab = getPublicTab();

  function verifyIdentity() {
    if (!userId.trim()) {
      window.alert(en ? "Please enter your ID." : "아이디를 입력해 주세요.");
      return;
    }
    setVerified(true);
  }

  function handleSendCode() {
    if (!email.trim()) {
      window.alert(en ? "Please enter your email address." : "이메일 주소를 입력해 주세요.");
      return;
    }
    const nextCode = String(Math.floor(Math.random() * 1000000)).padStart(6, "0");
    setSentCode(nextCode);
    setVerificationCode("");
    window.alert(`${en ? "Verification code: " : "인증번호: "}${nextCode}`);
  }

  function verifyEmailAndProceed() {
    if (!userId.trim()) {
      window.alert(en ? "Please enter your ID." : "아이디를 입력해 주세요.");
      return;
    }
    if (!email.trim()) {
      window.alert(en ? "Please enter your email address." : "이메일 주소를 입력해 주세요.");
      return;
    }
    if (!sentCode) {
      window.alert(en ? "Please send the verification code first." : "먼저 인증번호를 발송해 주세요.");
      return;
    }
    if (!verificationCode.trim()) {
      window.alert(en ? "Please enter the verification code." : "인증번호를 입력해 주세요.");
      return;
    }
    if (verificationCode.trim() !== sentCode) {
      window.alert(en ? "The verification code does not match." : "인증번호가 일치하지 않습니다.");
      return;
    }
    setVerified(true);
  }

  function isPasswordPolicyValid(password: string) {
    const categoryCount = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].reduce((count, regex) => count + (regex.test(password) ? 1 : 0), 0);
    return password.length >= 9 && categoryCount >= 3;
  }

  async function handleReset() {
    if (!verified) {
      window.alert(en ? "Please complete identity verification first." : "먼저 본인 확인을 완료해 주세요.");
      return;
    }
    if (!newPassword || !confirmPassword) {
      window.alert(en ? "Please enter your new password and confirmation." : "새 비밀번호와 확인 비밀번호를 입력해 주세요.");
      return;
    }
    if (!isPasswordPolicyValid(newPassword)) {
      window.alert(en ? "Please meet the password policy (at least 9 chars and 3 character types)." : "비밀번호 정책(9자리 이상, 3종류 조합)을 충족해 주세요.");
      return;
    }
    if (newPassword !== confirmPassword) {
      window.alert(en ? "New password and confirmation do not match." : "새 비밀번호와 확인 비밀번호가 일치하지 않습니다.");
      return;
    }
    setSaving(true);
    try {
      const body = await postJsonWithSession<{ status?: string; errors?: string }>(buildLocalizedPath("/signin/resetPassword", "/en/signin/resetPassword"), {
        userId: userId.trim(),
        newPassword,
        language: en ? "en" : "ko"
      });
      if (body.status !== "success") {
        throw new Error(body.errors || (en ? "Failed to change password." : "비밀번호 변경에 실패했습니다."));
      }
      navigate(buildLocalizedPath("/signin/findPassword/result", "/en/signin/findPassword/result"));
    } catch (error) {
      window.alert(error instanceof Error ? error.message : (en ? "Failed to change password." : "비밀번호 변경에 실패했습니다."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <PublicAuthShell
      languagePathKo={tab === "overseas" ? "/signin/findPassword/overseas" : "/signin/findPassword"}
      languagePathEn={tab === "overseas" ? "/en/signin/findPassword/overseas" : "/en/signin/findPassword"}
    >
      <main className="flex-grow flex flex-col items-center py-12 px-4" id="main-content">
        <div className="w-full max-w-2xl mb-8 text-center">
          <h2 className="text-3xl font-bold text-[var(--kr-gov-text-primary)] mb-4">{en ? "Reset Password" : "비밀번호 재설정"}</h2>
          <p className="text-[var(--kr-gov-text-secondary)]">
            {en ? "Please verify your identity and change your password to ensure secure service usage." : "안전한 서비스 이용을 위해 본인 확인 및 비밀번호 변경 절차를 진행합니다."}
          </p>
        </div>

        <div className="w-full max-w-2xl bg-white border border-[var(--kr-gov-border-light)] rounded-lg shadow-sm overflow-hidden mb-8">
          {tab === "overseas" ? (
            <div className="hidden flex border-b border-[var(--kr-gov-border-light)] bg-gray-50">
              <AppButton className="flex-1 py-4 text-[15px] font-medium border-b-4 border-transparent text-[var(--kr-gov-text-secondary)] hover:text-[var(--kr-gov-text-primary)] transition-colors" type="button" variant="ghost" size="lg">
                <span className="material-symbols-outlined">person_check</span>
                {en ? "Domestic User" : "국내 사용자"}
              </AppButton>
              <AppButton className="flex-1 py-4 text-[15px] font-bold border-b-4 border-[var(--kr-gov-blue)] text-[var(--kr-gov-blue)]" type="button" variant="ghost" size="lg">
                <span className="material-symbols-outlined">mail</span>
                {en ? "Overseas User" : "해외 사용자"}
              </AppButton>
            </div>
          ) : null}
          <div className="flex items-center justify-around bg-gray-50 border-b border-[var(--kr-gov-border-light)] p-6">
            <div className="flex flex-col items-center gap-2">
              <span className={`flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm ${verified ? "bg-gray-200 text-gray-500" : "bg-[var(--kr-gov-blue)] text-white"}`}>1</span>
              <span className={`text-sm ${verified ? "font-medium text-gray-500" : "font-bold text-[var(--kr-gov-blue)]"}`}>{en ? "Identity Verification" : "본인 확인"}</span>
            </div>
            <div className="flex-grow h-px bg-gray-200 mx-4 max-w-[100px]"></div>
            <div className="flex flex-col items-center gap-2">
              <span className={`flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm ${verified ? "bg-[var(--kr-gov-blue)] text-white" : "bg-gray-200 text-gray-500"}`}>2</span>
              <span className={`text-sm ${verified ? "font-bold text-[var(--kr-gov-blue)]" : "font-medium text-gray-500"}`}>{en ? "New Password" : "새 비밀번호 설정"}</span>
            </div>
          </div>

          <div className="p-8 lg:p-12">
            <div className="space-y-10">
              <section className={`space-y-6 ${verified ? "opacity-50 pointer-events-none" : ""}`} data-help-id="signin-find-password-verify">
                <div className={`flex items-center gap-2 pb-2 border-b-2 ${verified ? "border-gray-300" : "border-[var(--kr-gov-text-primary)]"}`}>
                  <span className={`material-symbols-outlined ${verified ? "text-gray-400" : "text-gray-700"}`}>person_search</span>
                  <h3 className={`text-lg font-bold ${verified ? "text-gray-500" : ""}`}>{tab === "overseas" ? (en ? "STEP 1. ID & Email Verification" : "STEP 1. 아이디 및 이메일 인증") : (en ? "STEP 1. ID & Identity Verification" : "STEP 1. 아이디 및 본인 확인")}</h3>
                </div>
                <div className="grid grid-cols-1 gap-6">
                  <div>
                    <label className="block text-sm font-bold text-[var(--kr-gov-text-secondary)] mb-2" htmlFor="user-id">{en ? "User ID" : "아이디"} <span className="text-red-600">*</span></label>
                    <AppInput className="public-field public-field--auth" id="user-id" onChange={(event) => setUserId(event.target.value)} placeholder={en ? "Please enter your registered ID" : "등록된 아이디를 입력하세요"} type="text" value={userId} />
                  </div>
                  {tab === "overseas" ? (
                    <div className="p-6 bg-slate-50 border border-slate-200 rounded-[var(--kr-gov-radius)] space-y-4">
                      <p className="text-sm font-medium text-[var(--kr-gov-text-secondary)]">
                        {en ? "Overseas users can reset passwords via registered email verification." : "해외 사용자는 등록된 이메일 인증으로 비밀번호를 재설정할 수 있습니다."}
                      </p>
                      <div>
                        <label className="block text-sm font-bold text-[var(--kr-gov-text-secondary)] mb-2" htmlFor="user-email">{en ? "Email Address" : "이메일 주소"} <span className="text-red-600">*</span></label>
                        <div className="flex gap-2">
                          <AppInput className="flex-grow public-field public-field--auth" id="user-email" inputMode="email" onChange={(event) => setEmail(event.target.value)} placeholder="example@institution.go.kr" type="text" value={email} />
                          <AppButton className="px-4 h-12 whitespace-nowrap" onClick={handleSendCode} type="button">
                            {en ? "Send Code" : "인증번호 발송"}
                          </AppButton>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-[var(--kr-gov-text-secondary)] mb-2" htmlFor="auth-code">{en ? "Verification Code" : "인증번호"} <span className="text-red-600">*</span></label>
                        <AppInput className="public-field public-field--auth" id="auth-code" inputMode="numeric" maxLength={6} onChange={(event) => setVerificationCode(event.target.value)} placeholder={en ? "Enter 6-digit verification code" : "인증번호 6자리를 입력하세요"} type="text" value={verificationCode} />
                      </div>
                      <AppButton className="w-full h-12" onClick={verifyEmailAndProceed} type="button">
                        {en ? "Verify Email & Continue" : "이메일 인증 확인"}
                      </AppButton>
                    </div>
                  ) : (
                    <div className="p-6 bg-slate-50 border border-slate-200 rounded-[var(--kr-gov-radius)]">
                      <p className="text-sm font-medium text-[var(--kr-gov-text-secondary)] mb-4">
                        {en ? "Please select one of the following verification methods to proceed." : "비밀번호 재설정을 위해 아래 인증 수단 중 하나를 선택하여 진행해 주세요."}
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {[
                          { icon: "badge", label: en ? "Joint Certificate" : "공동인증서" },
                          { icon: "phonelink_lock", label: en ? "OTP Auth" : "OTP 인증" },
                          { icon: "mail", label: en ? "Email Auth" : "이메일 인증" }
                        ].map((item) => (
                          <AppButton className="flex flex-col items-center gap-2 p-4 text-xs" key={item.label} onClick={verifyIdentity} type="button">
                            <span className="material-symbols-outlined">{item.icon}</span>
                            {item.label}
                          </AppButton>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </section>

              <div className={`relative ${verified ? "" : "opacity-30"}`}>
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t-2 border-dashed border-gray-300"></div></div>
                <div className="relative flex justify-center"><span className="bg-white px-2 text-xs font-bold text-gray-400">{en ? "Next Step" : "NEXT STEP"}</span></div>
              </div>

              <section className={`space-y-6 ${verified ? "" : "opacity-50 pointer-events-none"}`} data-help-id="signin-find-password-reset">
                <div className={`flex items-center gap-2 pb-2 border-b-2 ${verified ? "border-[var(--kr-gov-text-primary)]" : "border-gray-300"}`}>
                  <span className={`material-symbols-outlined ${verified ? "text-gray-700" : "text-gray-400"}`}>lock_reset</span>
                  <h3 className={`text-lg font-bold ${verified ? "" : "text-gray-500"}`}>{en ? "STEP 2. Set New Password" : "STEP 2. 새 비밀번호 설정"}</h3>
                </div>
                <div className="grid grid-cols-1 gap-6">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-bold text-[var(--kr-gov-text-secondary)] mb-2" htmlFor="new-password">{en ? "New Password" : "새 비밀번호"} <span className="text-red-600">*</span></label>
                      <AppInput className="public-field public-field--auth" disabled={!verified} id="new-password" onChange={(event) => setNewPassword(event.target.value)} placeholder={en ? "Enter new password" : "새 비밀번호를 입력하세요"} type="password" value={newPassword} />
                      <PasswordLevel en={en} password={newPassword} />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-[var(--kr-gov-text-secondary)] mb-2" htmlFor="confirm-password">{en ? "Confirm New Password" : "새 비밀번호 확인"} <span className="text-red-600">*</span></label>
                      <AppInput className="public-field public-field--auth" disabled={!verified} id="confirm-password" onChange={(event) => setConfirmPassword(event.target.value)} placeholder={en ? "Enter password again" : "다시 한번 입력하세요"} type="password" value={confirmPassword} />
                    </div>
                  </div>
                  <div className="bg-gray-50 p-5 rounded-[var(--kr-gov-radius)] border border-gray-200">
                    <h4 className="text-sm font-bold text-[var(--kr-gov-text-primary)] mb-2 flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm">info</span>
                      {en ? "Password Requirements" : "비밀번호 생성 규칙"}
                    </h4>
                    <ul className="text-xs text-[var(--kr-gov-text-secondary)] space-y-1.5 list-disc ml-4">
                      <li>{en ? <>Must be at least <span className="font-bold text-black">9 characters</span> long and use a combination of at least 3 types: uppercase/lowercase letters, numbers, and special characters.</> : <>영문 대/소문자, 숫자, 특수문자 중 3종류 이상을 조합하여 <span className="font-bold text-black">9자리 이상</span>으로 설정해야 합니다.</>}</li>
                      <li>{en ? "Avoid using easily guessable information such as your ID, consecutive numbers/letters, or date of birth." : "아이디와 동일한 문자, 연속된 숫자/문자, 생년월일 등 추측 가능한 정보는 사용을 자제해 주세요."}</li>
                      <li>{en ? "Recently used passwords cannot be reused." : "최근 사용한 비밀번호는 재사용할 수 없습니다."}</li>
                    </ul>
                  </div>
                </div>
              </section>
            </div>

            <div className="mt-12 flex gap-4" data-help-id="signin-find-password-actions">
              <AppLinkButton className="flex-1 h-14 text-lg" href={buildLocalizedPath("/signin/loginView", "/en/signin/loginView")}>
                {en ? "Cancel" : "취소"}
              </AppLinkButton>
              <AppButton className="flex-[2] h-14 text-lg" disabled={saving} onClick={() => void handleReset()} size="lg" type="button" variant="primary">
                {saving ? "..." : (en ? "Complete Password Change" : "비밀번호 변경 완료")}
              </AppButton>
            </div>
          </div>
        </div>

        <div className="w-full max-w-2xl bg-amber-50 border border-amber-100 p-5 rounded-[var(--kr-gov-radius)] flex gap-3">
          <span className="material-symbols-outlined text-amber-600">security</span>
          <div className="text-sm text-amber-900 leading-relaxed">
            <p className="font-bold mb-1">{en ? "Security Notice" : "안전한 비밀번호 관리를 위한 안내"}</p>
            <p>
              {en
                ? "For your security, please change your password periodically (every 3-6 months). Be careful not to disclose your password to others. The system stores passwords in encrypted form, and even administrators cannot view them."
                : "비밀번호는 주기적으로(최소 3~6개월) 변경하여 사용하시기 바랍니다. 타인에게 비밀번호가 노출되지 않도록 각별히 주의해 주십시오. 본 시스템은 비밀번호를 암호화하여 저장하며, 관리자도 알 수 없습니다."}
            </p>
          </div>
        </div>
      </main>
    </PublicAuthShell>
  );
}

export function FindPasswordCompletePage() {
  const en = isEnglish();

  return (
    <PublicAuthShell
      languagePathKo="/signin/findPassword/result"
      languagePathEn="/en/signin/findPassword/result"
    >
      <main className="flex-grow flex flex-col items-center justify-center py-16 px-4" id="main-content">
        <div className="w-full max-w-[580px] bg-white border border-[var(--kr-gov-border-light)] rounded-lg shadow-sm p-10 lg:p-14 text-center" data-help-id="signin-find-password-result-card">
          <div className="mb-8">
            <span className="material-symbols-outlined text-[80px] text-[var(--kr-gov-success)]" style={{ fontVariationSettings: "'wght' 600, 'opsz' 48" }}>check_circle</span>
          </div>
          <h2 className="text-3xl font-black text-[var(--kr-gov-text-primary)] mb-4">{en ? "Password Reset Complete" : "비밀번호 재설정 완료"}</h2>
          <p className="text-xl font-medium text-[var(--kr-gov-blue)] mb-2">
            {en ? "Your password has been successfully changed." : "비밀번호가 성공적으로 변경되었습니다."}
          </p>
          <p className="text-[var(--kr-gov-text-secondary)] text-lg mb-10 leading-relaxed">
            {en ? <>Please log in to the system with your new password <br className="hidden sm:block" /> to use the service.</> : <>새로운 비밀번호로 시스템에 로그인하여 <br className="hidden sm:block" /> 서비스를 이용해 주세요.</>}
          </p>
          <div className="bg-gray-50 border border-[var(--kr-gov-border-light)] rounded-[var(--kr-gov-radius)] p-5 mb-10 flex items-start gap-3 text-left">
            <span className="material-symbols-outlined text-[var(--kr-gov-text-secondary)] text-[20px]">lock</span>
            <p className="text-sm text-[var(--kr-gov-text-secondary)] leading-tight">
              {en ? <>Regular password changes are the safest way to <br className="hidden sm:block" /> protect your personal information.</> : <>주기적인 비밀번호 변경은 개인정보를 보호하는 <br className="hidden sm:block" /> 가장 안전한 방법입니다.</>}
            </p>
          </div>
          <AppLinkButton className="w-full h-16 text-xl" href={buildLocalizedPath("/signin/loginView", "/en/signin/loginView")} data-help-id="signin-find-password-result-action" size="lg" variant="primary">
            {en ? "Go to Login Screen" : "로그인 화면으로 이동"}
          </AppLinkButton>
        </div>

        <div className="mt-12 text-center">
          <p className="text-sm text-[var(--kr-gov-text-secondary)] leading-relaxed">
            {en ? <>Have questions about using the system? <br />Contact <span className="font-bold text-[var(--kr-gov-text-primary)]">Customer Support Center</span> at <span className="font-bold text-[var(--kr-gov-text-primary)]">02-1234-5678</span> or check the <AppLinkButton className="min-h-0 border-0 bg-transparent px-0 py-0 underline font-bold text-[var(--kr-gov-blue)] hover:bg-transparent" href="#" variant="ghost">Help Center</AppLinkButton>.</> : <>시스템 이용에 궁금한 점이 있으신가요? <br />고객지원센터 <span className="font-bold text-[var(--kr-gov-text-primary)]">02-1234-5678</span> 또는 <AppLinkButton className="min-h-0 border-0 bg-transparent px-0 py-0 underline font-bold text-[var(--kr-gov-blue)] hover:bg-transparent" href="#" variant="ghost">도움말 센터</AppLinkButton>를 확인해 주세요.</>}
          </p>
        </div>
      </main>
    </PublicAuthShell>
  );
}

export function ForbiddenPage() {
  const en = isEnglish();
  const pathCode = getSearchParam("pathCode") || "1";
  const sectionMap = en
    ? {
        "1": "Authentication",
        "2": "Security",
        "3": "Cooperation",
        "4": "User Service",
        "5": "System Management",
        "6": "System Integration"
      }
    : {
        "1": "인증",
        "2": "보안",
        "3": "협업",
        "4": "사용자 서비스",
        "5": "시스템 관리",
        "6": "시스템 연계"
      };
  const sectionLabel = sectionMap[pathCode as keyof typeof sectionMap] || (en ? "Authentication" : "인증");

  const deniedTitle = en ? "Access Denied" : "접근이 거부되었습니다.";
  const deniedMessage = en ? "You do not have permission to access this page." : "현재 페이지에 접근할 수 있는 권한이 없습니다.";

  return (
    <PublicAuthShell
      languagePathKo={`/signin/loginForbidden?pathCode=${encodeURIComponent(pathCode)}`}
      languagePathEn={`/en/signin/loginForbidden?pathCode=${encodeURIComponent(pathCode)}`}
    >
      <main className="flex-grow py-16 px-4" id="main-content">
        <div className="max-w-5xl mx-auto">
          <nav aria-label={en ? "Breadcrumb" : "브레드크럼"} className="mb-10">
            <ol className="flex flex-wrap items-center gap-2 text-sm text-[var(--kr-gov-text-secondary)]">
              <li>
                <a className="hover:underline" href={buildLocalizedPath("/home", "/en/home")}>{en ? "Home" : "홈"}</a>
              </li>
              <li>/</li>
              <li>{sectionLabel}</li>
            </ol>
          </nav>

          <section className="bg-white border border-[var(--kr-gov-border-light)] rounded-lg shadow-sm p-8 lg:p-10" data-help-id="signin-forbidden-card">
            <h2 className="text-3xl font-black text-[var(--kr-gov-text-primary)] mb-8">{deniedTitle}</h2>
            <div className="border-t border-[var(--kr-gov-border-light)] pt-8">
              <p className="text-lg font-bold text-[var(--kr-gov-text-primary)] mb-3">{deniedTitle}</p>
              <p className="text-[var(--kr-gov-text-secondary)] leading-relaxed">{deniedMessage}</p>
            </div>
          </section>
        </div>
      </main>
    </PublicAuthShell>
  );
}
