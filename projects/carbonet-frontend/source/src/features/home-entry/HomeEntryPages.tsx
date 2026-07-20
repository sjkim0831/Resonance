import { useEffect, useMemo, useState } from "react";
import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { logGovernanceScope } from "../../app/policy/debug";
import { buildLocalizedPath, getNavigationEventName, isEnglish } from "../../lib/navigation/runtime";
import { LOCALIZED_CONTENT } from "./homeEntryContent";
import {
  HomeFooter,
  HomeInlineStyles,
  CoreServiceGrid,
  HeroSection,
  NewsletterSection,
  RealtimeDashboardSection,
  SearchSection,
  ReferenceHomeLowerSection,
  SummarySection
} from "./HomeEntrySections";
import { HomePayload } from "./homeEntryTypes";
import { fetchHomePayload } from "../../lib/api/appBootstrap";
import { readBootstrappedHomePayload } from "../../lib/api/bootstrap";

export function HomeLandingPage() {
  const en = isEnglish();
  const content = en ? LOCALIZED_CONTENT.en : LOCALIZED_CONTENT.ko;
  const initialPayload = useMemo(() => readBootstrappedHomePayload() as HomePayload | null, []);
  const [publishedSections, setPublishedSections] = useState(() => new Set(["SUMMARY", "CERTIFICATE_VERIFY", "CORE_SERVICES", "NOTICE_SUPPORT", "NEWSLETTER"]));
  const payloadState = useAsyncValue<HomePayload>(
    () => initialPayload && !initialPayload.isLoggedIn ? Promise.resolve(initialPayload) : fetchHomePayload(),
    [en],
    {
      initialValue: initialPayload || { isLoggedIn: false, isEn: en, homeMenu: [] },
      onError: () => undefined
    }
  );
  useEffect(() => {
    function handleNavigationSync() {
      void payloadState.reload();
    }

    window.addEventListener(getNavigationEventName(), handleNavigationSync);
    return () => {
      window.removeEventListener(getNavigationEventName(), handleNavigationSync);
    };
  }, [payloadState]);

  const payload = payloadState.value || { isLoggedIn: false, isEn: en, homeMenu: [] };
  const homeMenu = payload.homeMenu || [];

  useEffect(() => {
    fetch(buildLocalizedPath("/home/api/composition?variant=PUBLIC", "/en/home/api/composition?variant=PUBLIC"), { credentials: "include" })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("composition unavailable")))
      .then((body) => setPublishedSections(new Set<string>((body.sections || []).map((section: { sectionCode: string }) => section.sectionCode))))
      .catch(() => undefined);
  }, [en]);

  const hasSection = (code: string) => publishedSections.has(code);

  useEffect(() => {
    logGovernanceScope("PAGE", "home-landing", {
      language: en ? "en" : "ko",
      isLoggedIn: Boolean(payload.isLoggedIn),
      menuCount: homeMenu.length
    });
    logGovernanceScope("COMPONENT", "home-landing-navigation", {
      menuCount: homeMenu.length,
      sessionLoaded: Boolean(payloadState.value)
    });
  }, [en, homeMenu.length, payload.isLoggedIn, payloadState.value]);

  return (
    <>
      <HomeInlineStyles en={en} />
      <div className="gov-home bg-white text-[var(--kr-gov-text-primary)]">
        <a className="skip-link" href="#main-content">{content.skipLink}</a>
        <main id="main-content">
          <div data-help-id="home-hero">
            <HeroSection content={content} />
          </div>
          <div data-help-id="home-search">
            <SearchSection content={content} homeMenu={homeMenu} />
          </div>
          {hasSection("SUMMARY") ? <div data-help-id="home-summary">
            <SummarySection content={content} />
          </div> : null}
          {hasSection("REALTIME_DASHBOARD") ? <RealtimeDashboardSection en={en} /> : null}
          {hasSection("CERTIFICATE_VERIFY") ? <section className="border-y border-emerald-200 bg-emerald-50/70">
            <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-8 lg:flex-row lg:items-center lg:justify-between lg:px-8">
              <div className="flex items-center gap-5">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-4 border-white bg-emerald-600 text-white shadow-md" aria-hidden="true">
                  <span className="material-symbols-outlined text-[34px]">verified_user</span>
                </div>
                <div>
                  <p className="gov-text-caption font-black uppercase tracking-[0.18em] text-emerald-700">{en ? "PUBLIC CERTIFICATE CHECK" : "공개 인증 서비스"}</p>
                  <h2 className="gov-text-heading-md mt-1 font-black text-slate-950">{en ? "Certificate Authenticity Verification" : "인증서 진위여부 확인"}</h2>
                  <p className="gov-text-body-sm mt-1 font-semibold text-slate-600">{en ? "Verify a downloaded certificate without signing in." : "로그인 없이 발급 인증서와 리포트의 진위 여부를 확인하세요."}</p>
                </div>
              </div>
              <a className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[var(--kr-gov-radius)] bg-emerald-700 px-6 py-3 font-black text-white hover:bg-emerald-800 focus-visible" href={buildLocalizedPath("/home/certificate-verify", "/en/home/certificate-verify")}>
                <span className="material-symbols-outlined">task_alt</span>
                {en ? "Verify Certificate" : "진위여부 확인하기"}
              </a>
            </div>
          </section> : null}
          {hasSection("CORE_SERVICES") ? <section className="gov-home-section max-w-7xl mx-auto px-4 lg:px-8" data-help-id="home-services">
            <div className="mb-10">
              <h2 className="gov-text-heading-md font-bold text-[var(--kr-gov-text-primary)]">{content.coreServicesTitle}</h2>
              <p className="gov-text-body mt-2 text-[var(--kr-gov-text-secondary)]">{content.coreServicesDescription}</p>
            </div>
            <CoreServiceGrid content={content} />
          </section> : null}
          {hasSection("NOTICE_SUPPORT") ? <ReferenceHomeLowerSection en={en} /> : null}
          {hasSection("NEWSLETTER") ? <NewsletterSection en={en} /> : null}
        </main>
        <HomeFooter content={content} />
      </div>
    </>
  );
}
