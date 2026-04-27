export type BootstrappedHomePayload = {
  isLoggedIn: boolean;
  isEn: boolean;
  homeMenu: Array<Record<string, unknown>>;
};

export type SitemapNode = {
  code?: string;
  label?: string;
  url?: string;
  icon?: string;
  children?: SitemapNode[];
};

export type SitemapPagePayload = {
  isEn?: boolean;
  isLoggedIn?: boolean;
  siteMapSections?: SitemapNode[];
};

export type HomeMenuPlaceholderPagePayload = {
  placeholderTitle?: string;
  placeholderTitleEn?: string;
  placeholderCode?: string;
  placeholderUrl?: string;
  placeholderIcon?: string;
  placeholderDescription?: string;
  isLoggedIn?: boolean;
  isEn?: boolean;
};

export type AdminMenuPlaceholderPagePayload = HomeMenuPlaceholderPagePayload;
