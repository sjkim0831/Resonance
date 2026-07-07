export const GOV_SYMBOL = "/img/egovframework/kr_gov_symbol.png";
export const GOV_SYMBOL_FALLBACK = "/img/egovframework/kr_gov_symbol.svg";

export type PriorityLevel = "CRITICAL" | "REQUIRED" | "VERIFICATION" | "INSIGHT";

export type SiteStatus = "normal" | "delayed" | "verifying" | "pending";

export type EmissionScope = "scope1" | "scope2" | "scope3";

export interface QueueItem {
  id: string;
  level: PriorityLevel;
  levelClass: string;
  due: string;
  dueDate: Date;
  title: string;
  titleEn: string;
  description: string;
  descriptionEn: string;
  cta: string;
  ctaEn: string;
  icon: string;
  siteId: string;
  siteName: string;
  siteNameEn: string;
  actionRequired: boolean;
  estimatedTime: string;
}

export interface DedicatedSite {
  id: string;
  title: string;
  titleEn: string;
  status: SiteStatus;
  statusLabel: string;
  statusLabelEn: string;
  statusClass: string;
  noticeClass: string;
  noticeIcon: "warning" | "verified" | "notifications_active";
  notice: string;
  noticeEn: string;
  noticeLink: string;
  noticeLinkEn: string;
  valueLabel: string;
  valueLabelEn: string;
  currentEmission: string;
  monthlyTarget: string;
  valueTone: string;
  sparkline: string;
  accentClass: string;
  pinClass: string;
  scope1Emission: string;
  scope2Emission: string;
  scope3Emission: string;
  dataCompleteness: string;
  lastUpdated: string;
  actions: Array<{ label: string; labelEn: string; icon: string; solid?: boolean }>;
  activity: Array<{ title: string; titleEn: string; meta: string; metaEn: string }>;
}

export interface GeneralSite {
  id: string;
  title: string;
  titleEn: string;
  emission: string;
  targetEmission: string;
  status: SiteStatus;
  statusLabel: string;
  statusLabelEn: string;
  statusClass: string;
  statusBgClass: string;
  action: string;
  actionEn: string;
  actionClass: string;
  dataCompleteness: string;
  lastInputDate: string;
  verifier: string;
  verifierEn: string;
}

export interface StatCard {
  id: string;
  title: string;
  titleEn: string;
  value: string;
  unit: string;
  trend?: string;
  trendDirection?: "up" | "down";
  trendEn?: string;
  icon: string;
  colorClass: string;
}

export interface ChartData {
  label: string;
  labelEn: string;
  value: number;
  color: string;
  heightPercent: number;
}

export interface TableColumn {
  key: string;
  label: string;
  labelEn: string;
  sortable: boolean;
  width?: string;
}

export interface TableRow {
  [key: string]: string | number | boolean;
}

export interface FilterOption {
  key: string;
  label: string;
  labelEn: string;
  count?: number;
}

export function handleGovSymbolError(event: React.SyntheticEvent<HTMLImageElement>) {
  const image = event.currentTarget;
  if (image.dataset.fallbackApplied === "1") {
    image.style.display = "none";
    return;
  }
  image.dataset.fallbackApplied = "1";
  image.src = GOV_SYMBOL_FALLBACK;
}

export function getStatusColors(status: SiteStatus): { bg: string; text: string; dot: string } {
  switch (status) {
    case "normal":
      return { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500" };
    case "delayed":
      return { bg: "bg-orange-50", text: "text-orange-700", dot: "bg-orange-500" };
    case "verifying":
      return { bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-500" };
    case "pending":
      return { bg: "bg-red-50", text: "text-red-700", dot: "bg-red-500" };
  }
}

export function getPriorityColors(level: PriorityLevel): { bg: string; border: string; dot: string } {
  switch (level) {
    case "CRITICAL":
      return { bg: "bg-red-500/20", border: "border-l-red-500", dot: "bg-red-400" };
    case "REQUIRED":
      return { bg: "bg-orange-500/20", border: "border-l-orange-500", dot: "bg-orange-400" };
    case "VERIFICATION":
      return { bg: "bg-blue-500/20", border: "border-l-blue-500", dot: "bg-blue-400" };
    case "INSIGHT":
      return { bg: "bg-emerald-500/20", border: "border-l-emerald-500", dot: "bg-emerald-400" };
  }
}