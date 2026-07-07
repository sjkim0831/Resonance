import { ReactNode, SyntheticEvent } from "react";

export const USER_GOV_MARK = "/img/egovframework/kr_gov_symbol.png";
export const USER_GOV_FOOTER_MARK = "/img/egovframework/kr_gov_symbol.png";
export const USER_GOV_MARK_FALLBACK = "/img/egovframework/kr_gov_symbol.svg";
export const USER_WA_MARK = "https://lh3.googleusercontent.com/aida-public/AB6AXuAzkKwREcbsB7LV3B2b7fBK7y2M_9Exa0vlGVzxNy2qM0n1LFMRlBCIa_XiIBeCfvv3DkMb9Z0D05Y-RMuAytisqlCS8QTpbtebgKnMnWoefEx5uJOgRW5H_8Pw9jmaRvkiW6sVRrifgIhrWc5hi2PRUGHgXn-q8-veHvu9wSwDhtcvbHKYyokgnP-hqdR10ahEAdBe4vFFkR88N_By8pjpp34KH9TwHOouRLBwdfVCsRGmDCS6wnvQZDwf6s4HyScSMXyJJGQjl8Y";

function handleGovMarkError(event: SyntheticEvent<HTMLImageElement>) {
  const image = event.currentTarget;
  if (image.dataset.fallbackApplied === "1") {
    image.style.display = "none";
    return;
  }
  image.dataset.fallbackApplied = "1";
  image.src = USER_GOV_MARK_FALLBACK;
}

function resolveFooterHref(label: string) {
  if (label === "사이트맵") {
    return "/sitemap";
  }
  if (label === "Sitemap") {
    return "/en/sitemap";
  }
  return "#";
}

export function UserGovernmentBar(props: {
  governmentText: string;
  guidelineText?: string;
}) {
  return (
    <div className="bg-[var(--kr-gov-bg-gray)] border-b border-[var(--kr-gov-border-light)]">
      <div className="max-w-7xl mx-auto px-4 lg:px-8 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img alt={props.governmentText} className="h-4" data-fallback-applied="0" onError={handleGovMarkError} src={USER_GOV_MARK} />
          <span className="text-[13px] font-medium text-[var(--kr-gov-text-secondary)]">{props.governmentText}</span>
        </div>
        {props.guidelineText ? (
          <div className="hidden md:flex items-center gap-4 text-xs font-medium text-[var(--kr-gov-text-secondary)]">
            <p>{props.guidelineText}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function UserLanguageToggle(props: {
  en: boolean;
  onKo: () => void;
  onEn: () => void;
}) {
  return (
    <div className="flex border border-[var(--kr-gov-border-light)] rounded-[var(--kr-gov-radius)] overflow-hidden">
      <button className={`px-3 py-1 text-xs font-bold ${props.en ? "bg-white text-[var(--kr-gov-text-secondary)] hover:bg-gray-100" : "bg-[var(--kr-gov-blue)] text-white"}`} onClick={props.onKo} type="button">KO</button>
      <button className={`px-3 py-1 text-xs font-bold border-l border-[var(--kr-gov-border-light)] ${props.en ? "bg-[var(--kr-gov-blue)] text-white" : "bg-white text-[var(--kr-gov-text-secondary)] hover:bg-gray-100"}`} onClick={props.onEn} type="button">EN</button>
    </div>
  );
}

export function UserPortalHeader(props: {
  brandTitle: string;
  brandSubtitle: string;
  homeHref?: string;
  onHomeClick?: () => void;
  rightContent?: ReactNode;
}) {
  const brand = (
    <>
      <span className="material-symbols-outlined text-[32px] text-[var(--kr-gov-blue)]" style={{ fontVariationSettings: "'wght' 600" }}>eco</span>
      <div className="flex flex-col">
        <h1 className="text-lg font-bold tracking-tight text-[var(--kr-gov-text-primary)] leading-none">{props.brandTitle}</h1>
        <p className="text-[9px] text-[var(--kr-gov-text-secondary)] font-bold uppercase tracking-wider mt-1">{props.brandSubtitle}</p>
      </div>
    </>
  );

  return (
    <header className="bg-white border-b border-[var(--kr-gov-border-light)] sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 lg:px-8">
        <div className="flex justify-between items-center h-20">
          <div className="flex items-center gap-3 shrink-0">
            {props.onHomeClick ? (
              <button className="flex items-center gap-2 focus-visible bg-transparent border-0 p-0" onClick={props.onHomeClick} type="button">
                {brand}
              </button>
            ) : (
              <a className="flex items-center gap-2 focus-visible" href={props.homeHref}>
                {brand}
              </a>
            )}
          </div>
          {props.rightContent ? <div className="flex flex-1 items-center justify-end gap-4">{props.rightContent}</div> : null}
        </div>
      </div>
    </header>
  );
}

export function UserPortalFooter(props: {
  orgName: string;
  addressLine: string;
  serviceLine?: string;
  footerLinks?: string[];
  copyright: string;
  lastModifiedLabel: string;
  waAlt: string;
}) {
  return (
    <footer className="bg-white border-t border-[var(--kr-gov-border-light)] mt-20">
      <div className="max-w-7xl mx-auto px-4 lg:px-8 pt-12 pb-8">
        <div className="flex flex-col md:flex-row justify-between gap-10 pb-10 border-b border-[var(--kr-gov-border-light)]">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <img alt={props.orgName} className="h-8 grayscale" data-fallback-applied="0" onError={handleGovMarkError} src={USER_GOV_FOOTER_MARK} />
              <span className="text-xl font-black text-[var(--kr-gov-text-primary)]">{props.orgName}</span>
            </div>
            <address className="not-italic text-sm text-[var(--kr-gov-text-secondary)] leading-relaxed">
              {props.addressLine}
              {props.serviceLine ? <><br />{props.serviceLine}</> : null}
            </address>
          </div>
          {props.footerLinks?.length ? (
            <div className="flex flex-wrap gap-x-8 gap-y-4 text-sm font-bold">
              {props.footerLinks.map((item, index) => (
                <a
                  className={index === 0 ? "text-[var(--kr-gov-blue)] hover:underline" : "text-[var(--kr-gov-text-primary)] hover:underline"}
                  href={resolveFooterHref(item)}
                  key={item}
                  onClick={(event) => {
                    if (resolveFooterHref(item) === "#") {
                      event.preventDefault();
                    }
                  }}
                >
                  {item}
                </a>
              ))}
            </div>
          ) : null}
        </div>
        <div className="mt-8 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="text-xs font-medium text-[var(--kr-gov-text-secondary)]">
            <p>{props.copyright}</p>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 px-3 py-1 bg-[var(--kr-gov-bg-gray)] rounded-[var(--kr-gov-radius)] text-xs font-bold text-[var(--kr-gov-text-secondary)]">
              <span>{props.lastModifiedLabel}</span>
              <time dateTime="2025-08-14">2025.08.14</time>
            </div>
            <img alt={props.waAlt} className="h-10" src={USER_WA_MARK} />
          </div>
        </div>
      </div>
    </footer>
  );
}
