import type { SyntheticEvent } from "react";

export type CommonUserFooterProps = {
  orgName: string;
  addressLine: string;
  serviceLine?: string;
  footerLinks?: string[];
  copyright: string;
  lastModifiedLabel: string;
  lastModifiedDate?: string;
  lastModifiedText?: string;
  waAlt: string;
  governmentMarkSrc: string;
  governmentMarkFallbackSrc?: string;
  waMarkSrc: string;
  className?: string;
};

function resolveFooterHref(label: string) {
  if (label === "사이트맵") return "/sitemap";
  if (label === "Sitemap") return "/en/sitemap";
  return "#";
}

export function CommonUserFooter({ className = "", ...props }: CommonUserFooterProps) {
  function handleMarkError(event: SyntheticEvent<HTMLImageElement>) {
    const image = event.currentTarget;
    if (!props.governmentMarkFallbackSrc || image.dataset.fallbackApplied === "1") {
      image.style.display = "none";
      return;
    }
    image.dataset.fallbackApplied = "1";
    image.src = props.governmentMarkFallbackSrc;
  }

  const dateTime = props.lastModifiedDate || "2025-08-14";
  return (
    <footer data-common-component="COMMON_PAGE_FOOTER" className={`border-t border-[var(--kr-gov-border-light)] bg-white ${className}`}>
      <div className="gov-home-footer mx-auto max-w-7xl px-4 lg:px-8">
        <div className="flex flex-col justify-between gap-7 border-b border-[var(--kr-gov-border-light)] pb-7 md:flex-row md:gap-10 md:pb-10">
          <div className="space-y-4">
            <div className="flex items-center gap-3"><img alt={props.orgName} className="h-8 grayscale" data-fallback-applied="0" onError={handleMarkError} src={props.governmentMarkSrc} /><span className="gov-text-heading-sm font-black text-[var(--kr-gov-text-primary)]">{props.orgName}</span></div>
            <address className="gov-text-body-sm not-italic text-[var(--kr-gov-text-secondary)]">{props.addressLine}{props.serviceLine ? <><br />{props.serviceLine}</> : null}</address>
          </div>
          {props.footerLinks?.length ? <nav aria-label="Footer" className="gov-text-body-sm flex flex-wrap gap-x-6 gap-y-3 font-bold md:gap-x-8 md:gap-y-4">{props.footerLinks.map((link, index) => { const href = resolveFooterHref(link); return <a className={index === 0 ? "text-[var(--kr-gov-blue)] hover:underline" : "text-[var(--kr-gov-text-primary)] hover:underline"} href={href} key={link} onClick={(event) => { if (href === "#") event.preventDefault(); }}>{link}</a>; })}</nav> : null}
        </div>
        <div className="mt-6 flex flex-col items-start justify-between gap-4 md:mt-8 md:flex-row md:items-center md:gap-6">
          <p className="gov-text-caption font-medium text-[var(--kr-gov-text-secondary)]">{props.copyright}</p>
          <div className="flex flex-wrap items-center gap-6"><div className="gov-text-caption flex items-center gap-2 rounded-[var(--kr-gov-radius)] bg-[var(--kr-gov-bg-gray)] px-3 py-1 font-bold text-[var(--kr-gov-text-secondary)]"><span>{props.lastModifiedLabel}</span><time dateTime={dateTime}>{props.lastModifiedText || dateTime.split("-").join(".")}</time></div><img alt={props.waAlt} className="h-10" src={props.waMarkSrc} /></div>
        </div>
      </div>
    </footer>
  );
}
