export type DesignStage = {
  id: string;
  nameKo: string;
  nameEn: string;
  userPath: string;
  adminPath: string;
  capabilities: string[];
  apiContract: string;
  dataOwner: string;
  authority: string;
  nextStage?: string;
};

export type DesignDomain = {
  id: string;
  nameKo: string;
  nameEn: string;
  pathPrefixes: string[];
  stages: DesignStage[];
};

export const SYSTEM_DESIGN_DOMAINS: DesignDomain[] = [
  {
    id: "emission", nameKo: "탄소배출 관리", nameEn: "Carbon Emission", pathPrefixes: ["/emission", "/admin/emission"],
    stages: [
      {id:"project",nameKo:"프로젝트 생성",nameEn:"Project Setup",userPath:"/emission/project/create",adminPath:"/admin/emission/management",capabilities:["create","assign","schedule"],apiContract:"emission-project-registry",dataOwner:"emission_project_registry",authority:"PROJECT_OWNER",nextStage:"collect"},
      {id:"collect",nameKo:"자료 수집",nameEn:"Data Collection",userPath:"/emission/activity-data",adminPath:"/admin/emission/survey-admin-data",capabilities:["request","upload","evidence","submit"],apiContract:"emission-activity-workflow",dataOwner:"emission_activity_data",authority:"PROJECT_ASSIGNEE",nextStage:"calculate"},
      {id:"calculate",nameKo:"산정",nameEn:"Calculation",userPath:"/emission/calculation",adminPath:"/admin/emission/calculation-rule",capabilities:["map-factor","convert-unit","calculate","recalculate"],apiContract:"emission-calculation-workflow",dataOwner:"emission_calculation_result",authority:"CALCULATOR",nextStage:"validate"},
      {id:"validate",nameKo:"검증·보완",nameEn:"Validation",userPath:"/emission/validate",adminPath:"/admin/emission/validate",capabilities:["validate","request-correction","resubmit"],apiContract:"emission-validation-workflow",dataOwner:"emission_validation_result",authority:"VERIFIER",nextStage:"approve"},
      {id:"approve",nameKo:"검토·승인",nameEn:"Review & Approval",userPath:"/emission/validate?tab=approval",adminPath:"/admin/emission/approval-workflow",capabilities:["review","approve","reject","reopen"],apiContract:"emission-approval-workflow",dataOwner:"emission_approval_history",authority:"APPROVER",nextStage:"report"},
      {id:"report",nameKo:"확정·보고",nameEn:"Finalization & Report",userPath:"/emission/report_submit",adminPath:"/admin/emission/survey-report",capabilities:["finalize","generate-report","submit","download"],apiContract:"emission-report-workflow",dataOwner:"emission_report",authority:"REPORT_MANAGER",nextStage:"monitor"},
      {id:"monitor",nameKo:"모니터링·감축",nameEn:"Monitoring & Reduction",userPath:"/monitoring/dashboard",adminPath:"/admin/system/monitoring-dashboard",capabilities:["monitor","alert","analyze","create-reduction-task"],apiContract:"emission-monitoring-workflow",dataOwner:"emission_monitoring_snapshot",authority:"ANALYST"}
    ]
  },
  {id:"lca",nameKo:"제품 LCA",nameEn:"Product LCA",pathPrefixes:["/lca","/admin/emission/survey"],stages:[]},
  {id:"reduction",nameKo:"감축 관리",nameEn:"Reduction",pathPrefixes:["/reduction","/admin/reduction"],stages:[]},
  {id:"monitoring",nameKo:"모니터링·분석",nameEn:"Monitoring & Analytics",pathPrefixes:["/monitoring","/admin/monitoring"],stages:[]},
  {id:"trade",nameKo:"탄소·자원 거래",nameEn:"Carbon & Resource Trade",pathPrefixes:["/co2","/trade","/admin/trade"],stages:[]},
  {id:"education",nameKo:"교육·지원",nameEn:"Education & Support",pathPrefixes:["/edu","/mtn","/admin/content"],stages:[]},
  {id:"platform",nameKo:"플랫폼 운영",nameEn:"Platform Operations",pathPrefixes:["/admin/system","/admin/member"],stages:[]}
];

export const REQUIRED_DESIGN_DIMENSIONS = ["menu","screen","capability","api","data","authority","workflow","admin","notification","audit","test"] as const;
