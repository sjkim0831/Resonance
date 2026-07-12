import { buildLocalizedPath, isEnglish } from "../../lib/navigation/runtime";
import { EmissionSurveyReportVerifyPage } from "../emission-survey-report/EmissionSurveyReportMigrationPage";
import { HOME_ENTRY_ASSETS, LOCALIZED_CONTENT } from "./homeEntryContent";
import { HeaderBrand, HomeFooter, HomeInlineStyles } from "./HomeEntrySections";

export function HomeCertificateVerifyPage() {
  const en = isEnglish();
  const content = en ? LOCALIZED_CONTENT.en : LOCALIZED_CONTENT.ko;
  return (
    <>
      <HomeInlineStyles en={en} />
      <div className="min-h-screen bg-slate-50 text-[var(--kr-gov-text-primary)]">
        <a className="skip-link" href="#certificate-verification">{content.skipLink}</a>
        <div className="border-b border-[var(--kr-gov-border-light)] bg-[var(--kr-gov-bg-gray)]">
          <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-2 lg:px-8">
            <img alt={content.govAlt} className="h-4" src={HOME_ENTRY_ASSETS.GOV_SYMBOL} />
            <span className="text-[13px] font-medium text-[var(--kr-gov-text-secondary)]">{content.govText}</span>
          </div>
        </div>
        <header className="border-b border-[var(--kr-gov-border-light)] bg-white shadow-sm">
          <div className="mx-auto flex h-24 max-w-7xl items-center px-4 lg:px-8">
            <HeaderBrand content={content} en={en} />
            <a className="ml-auto rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-blue)] px-5 py-2.5 font-bold text-[var(--kr-gov-blue)] hover:bg-blue-50" href={buildLocalizedPath("/home", "/en/home")}>
              {en ? "Back to Home" : "홈으로 돌아가기"}
            </a>
          </div>
        </header>
        <main id="certificate-verification">
          <section className="border-b border-slate-200 bg-white">
            <div className="mx-auto max-w-7xl px-4 py-10 lg:px-8">
              <nav aria-label={en ? "Breadcrumb" : "현재 위치"} className="flex items-center gap-2 text-sm font-semibold text-slate-500">
                <a className="hover:text-[var(--kr-gov-blue)]" href={buildLocalizedPath("/home", "/en/home")}>{en ? "Home" : "홈"}</a>
                <span aria-hidden="true">›</span>
                <span className="text-slate-800">{en ? "Certificate Authenticity" : "인증서 진위여부 확인"}</span>
              </nav>
              <div className="mt-6 flex items-start gap-5">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                  <span className="material-symbols-outlined text-[34px]">verified_user</span>
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-700">PUBLIC VERIFICATION</p>
                  <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 lg:text-4xl">{en ? "Certificate Authenticity Verification" : "인증서 진위여부 확인"}</h1>
                  <p className="mt-3 max-w-3xl text-base font-semibold leading-7 text-slate-600">{en ? "Upload a Carbonet report or certificate to compare its identifiers and complete dataset with the issued registry." : "Carbonet에서 발급한 리포트 또는 인증서를 업로드하여 식별 정보와 전체 데이터셋을 발급 원장과 대조합니다."}</p>
                </div>
              </div>
            </div>
          </section>
          <section className="mx-auto max-w-7xl px-4 py-10 lg:px-8">
            <EmissionSurveyReportVerifyPage embedded />
          </section>
        </main>
        <HomeFooter content={content} />
      </div>
    </>
  );
}
