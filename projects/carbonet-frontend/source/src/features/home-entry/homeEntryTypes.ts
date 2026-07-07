export type HomeMenuItem = {
  label?: string;
  url?: string;
  sections?: Array<{
    label?: string;
    items?: Array<{ label?: string; url?: string }>;
  }>;
};

export type HomePayload = {
  isLoggedIn: boolean;
  isEn: boolean;
  homeMenu: HomeMenuItem[];
};

export type SummaryCard = {
  title: string;
  badge?: string;
  value?: string;
  unit?: string;
  progressLabel?: string;
  progressValue?: string;
  progressWidth?: string;
  statBlocks?: Array<{ label: string; value: string; unit?: string }>;
  note?: string;
  rows?: Array<{ label: string; value: string }>;
  ringText?: string;
  ringNote?: string;
};

export type HomeQuickLink = {
  label: string;
  href: string;
  query?: string;
};

export type HomeServiceItem = {
  icon: string;
  title: string;
  description: string;
  href: string;
};
