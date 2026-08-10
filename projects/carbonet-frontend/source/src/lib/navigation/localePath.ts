function isEnglishPath(pathname: string): boolean {
  return pathname.startsWith("/en/")
    || pathname === "/join/en"
    || pathname.startsWith("/join/en/");
}

export function isEnglishLocale(): boolean {
  return window.__CARBONET_REACT_MIGRATION__?.locale === "en"
    || document.documentElement.lang === "en"
    || isEnglishPath(window.location.pathname);
}

export function localizedPath(koPath: string, enPath: string): string {
  return isEnglishLocale() ? enPath : koPath;
}
