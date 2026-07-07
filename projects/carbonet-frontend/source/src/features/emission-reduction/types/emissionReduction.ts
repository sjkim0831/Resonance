export type ScenarioData = {
  id: string;
  name: string;
  color: string;
  reduction: number;
  cost: number;
  feasibility: string;
};

export type RoadmapMilestone = {
  year: number;
  target: string;
  achieved: string;
  status: "completed" | "in-progress" | "pending";
};

export type SiteReduction = {
  siteId: string;
  siteName: string;
  reduction: number;
  rank: number;
  trend: "up" | "down" | "stable";
};

export type MethodologyItem = {
  id: string;
  name: string;
  contribution: number;
  icon: string;
  color: string;
};

export type InvestmentItem = {
  category: string;
  amount: number;
  expectedReduction: number;
  timeline: string;
};

export type AlertNotification = {
  id: string;
  type: "warning" | "info" | "success";
  title: string;
  description: string;
  timestamp: string;
};
