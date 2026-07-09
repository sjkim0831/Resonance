import type { BootstrappedHomePayload } from "./appBootstrapTypes";
import type { AdminMenuTreePayload } from "./adminShellTypes";

type HomeMenuSection = {
  label?: string;
  items?: Array<{ label?: string; url?: string }>;
};

type HomeMenuRecord = {
  label?: string;
  url?: string;
  sections?: HomeMenuSection[];
};

const EMISSION_HOME_MENU_KO: HomeMenuRecord = {
  label: "탄소 배출",
  url: "/emission/index",
  sections: [
    {
      label: "업무 시작",
      items: [
        { label: "탄소 배출 대시보드", url: "/emission/index" },
        { label: "배출량 관리", url: "/emission/project_list" },
        { label: "내 배출 업무", url: "/emission/my-tasks" }
      ]
    },
    {
      label: "입력·검증",
      items: [
        { label: "활동자료 입력", url: "/emission/data_input" },
        { label: "증빙 자료함", url: "/emission/evidence" },
        { label: "검증·보정", url: "/emission/validate" }
      ]
    },
    {
      label: "산정·보고",
      items: [
        { label: "배출량 산정", url: "/emission/simulate" },
        { label: "산정 결과 조회", url: "/emission/result" },
        { label: "배출량 보고서 작성", url: "/emission/report_submit" }
      ]
    },
    {
      label: "분석·감축",
      items: [
        { label: "LCA 분석", url: "/emission/lca" },
        { label: "감축 시나리오", url: "/emission/reduction" },
        { label: "LCI DB 조회", url: "/emission/lci" }
      ]
    }
  ]
};

const EMISSION_HOME_MENU_EN: HomeMenuRecord = {
  label: "Carbon Emission",
  url: "/en/emission/index",
  sections: [
    {
      label: "Start",
      items: [
        { label: "Emission Dashboard", url: "/en/emission/index" },
        { label: "Emission Management", url: "/en/emission/project_list" },
        { label: "My Emission Tasks", url: "/en/emission/my-tasks" }
      ]
    },
    {
      label: "Input & Validation",
      items: [
        { label: "Activity Data Input", url: "/en/emission/data_input" },
        { label: "Evidence Library", url: "/en/emission/evidence" },
        { label: "Validation & Correction", url: "/en/emission/validate" }
      ]
    },
    {
      label: "Calculation & Report",
      items: [
        { label: "Emission Calculation", url: "/en/emission/simulate" },
        { label: "Calculation Results", url: "/en/emission/result" },
        { label: "Emission Report", url: "/en/emission/report_submit" }
      ]
    },
    {
      label: "Analysis & Reduction",
      items: [
        { label: "LCA Analysis", url: "/en/emission/lca" },
        { label: "Reduction Scenario", url: "/en/emission/reduction" },
        { label: "LCI DB", url: "/en/emission/lci" }
      ]
    }
  ]
};

const HOME_MENU_KO: HomeMenuRecord[] = [
  EMISSION_HOME_MENU_KO,
  {
    label: "모니터링",
    url: "/monitoring/index",
    sections: [
      {
        label: "관제",
        items: [
          { label: "모니터링 대시보드", url: "/monitoring/index" },
          { label: "통합 대시보드", url: "/monitoring/dashboard" },
          { label: "실시간 모니터링", url: "/monitoring/realtime" },
          { label: "경보 현황", url: "/monitoring/alerts" }
        ]
      },
      {
        label: "분석·공유",
        items: [
          { label: "ESG 보고서", url: "/monitoring/statistics" },
          { label: "이해관계자 공유", url: "/monitoring/share" },
          { label: "성과 추이 분석", url: "/monitoring/reduction_trend" },
          { label: "추적 리포트", url: "/monitoring/track" },
          { label: "분석 리포트 내보내기", url: "/monitoring/export" }
        ]
      }
    ]
  },
  {
    label: "MRV·탄소시장",
    url: "/co2/index",
    sections: [
      {
        label: "MRV 정보",
        items: [
          { label: "MRV·탄소시장 대시보드", url: "/co2/index" },
          { label: "MRV 정보", url: "/co2/search" },
          { label: "무결성 추적", url: "/co2/integrity" },
          { label: "품질 지표", url: "/co2/analysis" }
        ]
      },
      {
        label: "시장 연계",
        items: [
          { label: "생산 정보", url: "/co2/production_list" },
          { label: "수요 정보", url: "/co2/demand_list" },
          { label: "탄소 크레딧", url: "/co2/credit" }
        ]
      }
    ]
  },
  {
    label: "거래",
    url: "/trade/index",
    sections: [
      {
        label: "거래 업무",
        items: [
          { label: "거래 대시보드", url: "/trade/index" },
          { label: "거래 목록", url: "/trade/list" },
          { label: "거래 시장", url: "/trade/market" },
          { label: "구매 요청", url: "/trade/buy_request" },
          { label: "판매 등록", url: "/trade/sell" }
        ]
      },
      {
        label: "체결·자동화",
        items: [
          { label: "체결 현황", url: "/trade/complete" },
          { label: "자동 매칭", url: "/trade/auto_order" },
          { label: "가격 알림", url: "/trade/price_alert" },
          { label: "거래 리포트", url: "/trade/report" }
        ]
      }
    ]
  },
  {
    label: "결제",
    url: "/payment/index",
    sections: [
      {
        label: "결제 처리",
        items: [
          { label: "결제 대시보드", url: "/payment/index" },
          { label: "결제 요청", url: "/payment/pay" },
          { label: "가상계좌", url: "/payment/virtual_account" },
          { label: "결제 내역", url: "/payment/history" }
        ]
      },
      {
        label: "정산·환불",
        items: [
          { label: "영수증 관리", url: "/payment/receipt" },
          { label: "세금계산서", url: "/payment/notify" },
          { label: "결제 환불", url: "/payment/refund" },
          { label: "환불 계좌", url: "/payment/refund_account" }
        ]
      }
    ]
  },
  {
    label: "인증서",
    url: "/certificate/index",
    sections: [
      {
        label: "인증서 업무",
        items: [
          { label: "인증서 대시보드", url: "/certificate/index" },
          { label: "인증서 목록", url: "/certificate/list" },
          { label: "인증서 신청", url: "/certificate/apply" }
        ]
      },
      {
        label: "보고서",
        items: [
          { label: "보고서 및 인증서 목록", url: "/certificate/report_list" },
          { label: "보고서 작성", url: "/certificate/report_form" },
          { label: "보고서 수정", url: "/certificate/report_edit" }
        ]
      }
    ]
  },
  {
    label: "교육",
    url: "/edu/index",
    sections: [
      {
        label: "교육 과정",
        items: [
          { label: "교육 대시보드", url: "/edu/index" },
          { label: "교육과정 목록", url: "/edu/course_list" },
          { label: "과정 상세", url: "/edu/course_detail" },
          { label: "교육 신청", url: "/edu/apply" }
        ]
      },
      {
        label: "나의 학습",
        items: [
          { label: "나의 교육", url: "/edu/my_course" },
          { label: "진도 관리", url: "/edu/progress" },
          { label: "설문조사", url: "/edu/survey" },
          { label: "수료증", url: "/edu/certificate" },
          { label: "자격 연계", url: "/edu/content" }
        ]
      }
    ]
  },
  {
    label: "고객지원",
    url: "/support/index",
    sections: [
      {
        label: "지원",
        items: [
          { label: "고객지원 대시보드", url: "/support/index" },
          { label: "공지사항", url: "/support/notice_list" },
          { label: "자료실", url: "/support/download_list" },
          { label: "FAQ", url: "/support/faq" },
          { label: "지원 통합검색", url: "/support/qna_list" }
        ]
      },
      {
        label: "문의·안내",
        items: [
          { label: "문의 내역", url: "/support/inquiry" },
          { label: "사이트맵", url: "/sitemap" }
        ]
      }
    ]
  },
  {
    label: "서비스 운영",
    url: "/mtn/index",
    sections: [
      {
        label: "운영 현황",
        items: [
          { label: "서비스 운영 대시보드", url: "/mtn/index" },
          { label: "서비스 상태", url: "/mtn/status" },
          { label: "버전 관리", url: "/mtn/version" },
          { label: "1:1 문의", url: "/mtn/my_inquiry" }
        ]
      }
    ]
  },
  {
    label: "마이페이지",
    url: "/mypage/index",
    sections: [
      {
        label: "내 정보",
        items: [
          { label: "마이페이지 대시보드", url: "/mypage/index" },
          { label: "마이페이지", url: "/mypage/profile" },
          { label: "이메일/전화 변경", url: "/mypage/email" },
          { label: "비밀번호 변경", url: "/mypage/password" }
        ]
      },
      {
        label: "기업·알림",
        items: [
          { label: "기업 정보", url: "/mypage/company" },
          { label: "담당자 관리", url: "/mypage/staff" },
          { label: "알림 설정", url: "/mypage/notification" },
          { label: "마케팅 수신", url: "/mypage/marketing" }
        ]
      }
    ]
  }
];

const HOME_MENU_EN: HomeMenuRecord[] = [
  EMISSION_HOME_MENU_EN,
  {
    label: "Monitoring",
    url: "/en/monitoring/index",
    sections: [
      { label: "Operations", items: [
        { label: "Monitoring Dashboard", url: "/en/monitoring/index" },
        { label: "Integrated Dashboard", url: "/en/monitoring/dashboard" },
        { label: "Realtime Monitoring", url: "/en/monitoring/realtime" },
        { label: "Alerts", url: "/en/monitoring/alerts" }
      ] },
      { label: "Analysis & Sharing", items: [
        { label: "ESG Report", url: "/en/monitoring/statistics" },
        { label: "Stakeholder Sharing", url: "/en/monitoring/share" },
        { label: "Reduction Trend", url: "/en/monitoring/reduction_trend" },
        { label: "Trace Report", url: "/en/monitoring/track" },
        { label: "Export Analysis Report", url: "/en/monitoring/export" }
      ] }
    ]
  },
  {
    label: "MRV & Market",
    url: "/en/co2/index",
    sections: [
      { label: "MRV", items: [
        { label: "MRV & Market Dashboard", url: "/en/co2/index" },
        { label: "MRV Information", url: "/en/co2/search" },
        { label: "Integrity Tracking", url: "/en/co2/integrity" },
        { label: "Quality Metrics", url: "/en/co2/analysis" }
      ] },
      { label: "Market", items: [
        { label: "Production Information", url: "/en/co2/production_list" },
        { label: "Demand Information", url: "/en/co2/demand_list" },
        { label: "Carbon Credit", url: "/en/co2/credit" }
      ] }
    ]
  },
  {
    label: "Trade",
    url: "/en/trade/index",
    sections: [
      { label: "Trading", items: [
        { label: "Trade Dashboard", url: "/en/trade/index" },
        { label: "Trade List", url: "/en/trade/list" },
        { label: "Trade Market", url: "/en/trade/market" },
        { label: "Buy Request", url: "/en/trade/buy_request" },
        { label: "Sell Registration", url: "/en/trade/sell" }
      ] },
      { label: "Execution", items: [
        { label: "Completed Trades", url: "/en/trade/complete" },
        { label: "Auto Matching", url: "/en/trade/auto_order" },
        { label: "Price Alerts", url: "/en/trade/price_alert" },
        { label: "Trade Report", url: "/en/trade/report" }
      ] }
    ]
  },
  {
    label: "Payment",
    url: "/en/payment/index",
    sections: [
      { label: "Payment", items: [
        { label: "Payment Dashboard", url: "/en/payment/index" },
        { label: "Payment Request", url: "/en/payment/pay" },
        { label: "Virtual Account", url: "/en/payment/virtual_account" },
        { label: "Payment History", url: "/en/payment/history" }
      ] },
      { label: "Settlement & Refund", items: [
        { label: "Receipts", url: "/en/payment/receipt" },
        { label: "Tax Invoice", url: "/en/payment/notify" },
        { label: "Refund", url: "/en/payment/refund" },
        { label: "Refund Account", url: "/en/payment/refund_account" }
      ] }
    ]
  },
  {
    label: "Certificate",
    url: "/en/certificate/index",
    sections: [
      { label: "Certificate", items: [
        { label: "Certificate Dashboard", url: "/en/certificate/index" },
        { label: "Certificate List", url: "/en/certificate/list" },
        { label: "Certificate Application", url: "/en/certificate/apply" }
      ] },
      { label: "Report", items: [
        { label: "Reports & Certificates", url: "/en/certificate/report_list" },
        { label: "Create Report", url: "/en/certificate/report_form" },
        { label: "Edit Report", url: "/en/certificate/report_edit" }
      ] }
    ]
  },
  {
    label: "Education",
    url: "/en/edu/index",
    sections: [
      { label: "Courses", items: [
        { label: "Education Dashboard", url: "/en/edu/index" },
        { label: "Course List", url: "/en/edu/course_list" },
        { label: "Course Detail", url: "/en/edu/course_detail" },
        { label: "Apply", url: "/en/edu/apply" }
      ] },
      { label: "My Learning", items: [
        { label: "My Courses", url: "/en/edu/my_course" },
        { label: "Progress", url: "/en/edu/progress" },
        { label: "Survey", url: "/en/edu/survey" },
        { label: "Certificate", url: "/en/edu/certificate" },
        { label: "Qualification", url: "/en/edu/content" }
      ] }
    ]
  },
  {
    label: "Support",
    url: "/en/support/index",
    sections: [
      { label: "Support", items: [
        { label: "Support Dashboard", url: "/en/support/index" },
        { label: "Notice", url: "/en/support/notice_list" },
        { label: "Downloads", url: "/en/support/download_list" },
        { label: "FAQ", url: "/en/support/faq" },
        { label: "Support Search", url: "/en/support/qna_list" }
      ] },
      { label: "Inquiry & Guide", items: [
        { label: "Inquiry History", url: "/en/support/inquiry" },
        { label: "Sitemap", url: "/en/sitemap" }
      ] }
    ]
  },
  {
    label: "Service Ops",
    url: "/en/mtn/index",
    sections: [
      { label: "Status", items: [
        { label: "Service Ops Dashboard", url: "/en/mtn/index" },
        { label: "Service Status", url: "/en/mtn/status" },
        { label: "Version Management", url: "/en/mtn/version" },
        { label: "1:1 Inquiry", url: "/en/mtn/my_inquiry" }
      ] }
    ]
  },
  {
    label: "My Page",
    url: "/en/mypage/index",
    sections: [
      { label: "Profile", items: [
        { label: "My Page Dashboard", url: "/en/mypage/index" },
        { label: "Profile", url: "/en/mypage/profile" },
        { label: "Email / Phone", url: "/en/mypage/email" },
        { label: "Password", url: "/en/mypage/password" }
      ] },
      { label: "Company & Notification", items: [
        { label: "Company Information", url: "/en/mypage/company" },
        { label: "Staff Management", url: "/en/mypage/staff" },
        { label: "Notifications", url: "/en/mypage/notification" },
        { label: "Marketing Consent", url: "/en/mypage/marketing" }
      ] }
    ]
  }
];

const EMISSION_ADMIN_DOMAIN = {
  label: "배출량 관리",
  labelEn: "Emission Management",
  summary: "배출지, 계수, 입력 템플릿, 검증, 산정, 보고서, 증빙, 감사, 외부연계를 관리합니다.",
  groups: [
    {
      title: "기준정보",
      titleEn: "Master Data",
      icon: "account_tree",
      links: [
        { code: "AMENU_EMISSION_SITE_SOURCE", text: "배출지·배출원 원장", tEn: "Sites & Sources", u: "/admin/emission/site-management", icon: "domain" },
        { code: "AMENU_EMISSION_FACTOR", text: "배출계수 관리", tEn: "Emission Factors", u: "/admin/emission/factor-management", icon: "science" },
        { code: "AMENU_EMISSION_CALC_RULE", text: "산정식 관리", tEn: "Calculation Rules", u: "/admin/emission/calculation-rule", icon: "functions" },
        { code: "AMENU_EMISSION_INPUT_TEMPLATE", text: "입력 템플릿 관리", tEn: "Input Templates", u: "/admin/emission/input-template", icon: "view_list" }
      ]
    },
    {
      title: "검증·승인",
      titleEn: "Validation & Approval",
      icon: "fact_check",
      links: [
        { code: "AMENU_EMISSION_VALIDATE", text: "검증 관리", tEn: "Validation Queue", u: "/admin/emission/validate", icon: "rule" },
        { code: "AMENU_EMISSION_VALIDATION_RULE", text: "검증 규칙 관리", tEn: "Validation Rules", u: "/admin/emission/validation-rule", icon: "rule_settings" },
        { code: "AMENU_EMISSION_APPROVAL_WORKFLOW", text: "승인 워크플로우 관리", tEn: "Approval Workflow", u: "/admin/emission/approval-workflow", icon: "approval" }
      ]
    },
    {
      title: "산정·보고",
      titleEn: "Calculation & Report",
      icon: "summarize",
      links: [
        { code: "AMENU_EMISSION_RESULT_LIST", text: "산정 결과 관리", tEn: "Calculation Results", u: "/admin/emission/result_list", icon: "analytics" },
        { code: "AMENU_EMISSION_REPORT_TEMPLATE", text: "보고서 템플릿 관리", tEn: "Report Templates", u: "/admin/emission/report-template", icon: "description" },
        { code: "AMENU_EMISSION_GWP", text: "GWP 값 관리", tEn: "GWP Values", u: "/admin/emission/gwp-values", icon: "public" },
        { code: "AMENU_EMISSION_ECOINVENT", text: "ecoinvent 배출계수 관리", tEn: "ecoinvent Factors", u: "/admin/emission/ecoinvent", icon: "science" }
      ]
    },
    {
      title: "증빙·감사·연계",
      titleEn: "Evidence, Audit & Integration",
      icon: "verified_user",
      links: [
        { code: "AMENU_EMISSION_EVIDENCE", text: "증빙 관리", tEn: "Evidence Management", u: "/admin/emission/evidence-management", icon: "folder_open" },
        { code: "AMENU_EMISSION_DATA_HISTORY", text: "데이터 변경 이력", tEn: "Data Change History", u: "/admin/emission/data_history", icon: "history" },
        { code: "AMENU_EMISSION_AUDIT_LOG", text: "감사 로그", tEn: "Audit Log", u: "/admin/emission/audit-log", icon: "receipt_long" },
        { code: "AMENU_EMISSION_SYSTEM_LINK", text: "외부 시스템 연계", tEn: "External System Links", u: "/admin/emission/system-link", icon: "hub" }
      ]
    },
    {
      title: "설문·LCA",
      titleEn: "Survey & LCA",
      icon: "assignment",
      links: [
        { code: "AMENU_EMISSION_SURVEY_ADMIN", text: "배출 설문 관리", tEn: "Emission Survey", u: "/admin/emission/survey-admin", icon: "assignment" },
        { code: "AMENU_EMISSION_SURVEY_DATA", text: "배출 설문 데이터셋", tEn: "Survey Dataset", u: "/admin/emission/survey-admin-data", icon: "dataset" },
        { code: "AMENU_EMISSION_LCI_CLASS", text: "LCI 분류 관리", tEn: "LCI Classification", u: "/admin/emission/lci-classification", icon: "category" },
        { code: "AMENU_EMISSION_DEFINITION", text: "배출 정의 관리", tEn: "Emission Definition", u: "/admin/emission/definition-studio", icon: "schema" }
      ]
    }
  ]
};

const ADMIN_DOMAIN_OVERRIDES: AdminMenuTreePayload = {
  A001: {
    label: "회원·권한",
    labelEn: "Members & Authority",
    summary: "회원, 회원사, 관리자, 권한, 승인 업무를 관리합니다.",
    groups: [
      { title: "회원", titleEn: "Members", icon: "groups", links: [
        { code: "AMENU_MEMBER_LIST", text: "회원 목록", tEn: "Member List", u: "/admin/member/list", icon: "person_search" },
        { code: "AMENU_MEMBER_REGISTER", text: "회원 등록", tEn: "Register Member", u: "/admin/member/register", icon: "person_add" },
        { code: "AMENU_MEMBER_STATS", text: "회원 통계", tEn: "Member Statistics", u: "/admin/member/stats", icon: "query_stats" },
        { code: "AMENU_MEMBER_WITHDRAWN", text: "탈퇴 회원", tEn: "Withdrawn Members", u: "/admin/member/withdrawn", icon: "person_off" },
        { code: "AMENU_MEMBER_ACTIVATE", text: "휴면 계정", tEn: "Dormant Accounts", u: "/admin/member/activate", icon: "restart_alt" }
      ] },
      { title: "회원사", titleEn: "Companies", icon: "business", links: [
        { code: "AMENU_COMPANY_LIST", text: "회원사 목록", tEn: "Company List", u: "/admin/member/company_list", icon: "domain" },
        { code: "AMENU_COMPANY_ACCOUNT", text: "회원사 계정", tEn: "Company Accounts", u: "/admin/member/company_account", icon: "badge" },
        { code: "AMENU_MEMBER_APPROVE", text: "회원 승인", tEn: "Member Approval", u: "/admin/member/approve", icon: "how_to_reg" },
        { code: "AMENU_COMPANY_APPROVE", text: "회원사 승인", tEn: "Company Approval", u: "/admin/member/company-approve", icon: "approval" }
      ] },
      { title: "관리자·권한", titleEn: "Admins & Authority", icon: "admin_panel_settings", links: [
        { code: "AMENU_ADMIN_LIST", text: "관리자 목록", tEn: "Admin List", u: "/admin/member/admin_list", icon: "supervisor_account" },
        { code: "AMENU_ADMIN_CREATE", text: "관리자 생성", tEn: "Create Admin", u: "/admin/member/admin_account", icon: "manage_accounts" },
        { code: "AMENU_ADMIN_PERMISSION", text: "관리자 권한", tEn: "Admin Permissions", u: "/admin/member/admin_account/permissions", icon: "key" },
        { code: "AMENU_AUTH_GROUP", text: "권한 그룹", tEn: "Authority Groups", u: "/admin/auth/group", icon: "verified_user" },
        { code: "AMENU_AUTH_CHANGE", text: "권한 변경", tEn: "Authority Changes", u: "/admin/member/auth-change", icon: "published_with_changes" },
        { code: "AMENU_DEPT_ROLE", text: "부서 권한 맵핑", tEn: "Department Role Mapping", u: "/admin/member/dept-role-mapping", icon: "account_tree" },
        { code: "AMENU_PASSWORD_RESET", text: "비밀번호 초기화", tEn: "Password Reset", u: "/admin/member/reset_password", icon: "lock_reset" }
      ] }
    ]
  },
  A002: EMISSION_ADMIN_DOMAIN,
  A003: {
    label: "거래·결제·인증",
    labelEn: "Trade, Payment & Certificate",
    summary: "거래 승인, 정산, 환불, 인증서 검토와 통계를 관리합니다.",
    groups: [
      { title: "거래 관리", titleEn: "Trade", icon: "sync_alt", links: [
        { code: "AMENU_TRADE_STATISTICS", text: "정산 리포트", tEn: "Settlement Report", u: "/admin/trade/statistics", icon: "bar_chart" },
        { code: "AMENU_TRADE_DUPLICATE", text: "이상거래 점검", tEn: "Anomaly Review", u: "/admin/trade/duplicate", icon: "troubleshoot" },
        { code: "AMENU_TRADE_APPROVE", text: "거래 승인", tEn: "Trade Approval", u: "/admin/trade/approve", icon: "task_alt" },
        { code: "AMENU_TRADE_REJECT", text: "거래 반려 검토", tEn: "Trade Rejection Review", u: "/admin/trade/reject", icon: "block" }
      ] },
      { title: "결제·환불", titleEn: "Payment & Refund", icon: "payments", links: [
        { code: "AMENU_REFUND_LIST", text: "환불 요청 목록", tEn: "Refund Requests", u: "/admin/payment/refund_list", icon: "request_page" },
        { code: "AMENU_REFUND_PROCESS", text: "환불 처리", tEn: "Refund Processing", u: "/admin/payment/refund_process", icon: "currency_exchange" },
        { code: "AMENU_SETTLEMENT_CALENDAR", text: "정산 캘린더", tEn: "Settlement Calendar", u: "/admin/payment/settlement", icon: "event" },
        { code: "AMENU_VIRTUAL_ISSUE", text: "환불 계좌 검수", tEn: "Refund Account Review", u: "/admin/payment/virtual_issue", icon: "account_balance" }
      ] },
      { title: "인증서", titleEn: "Certificate", icon: "workspace_premium", links: [
        { code: "AMENU_CERTIFICATE_PENDING", text: "인증서 발급 대기", tEn: "Pending Certificates", u: "/admin/certificate/pending_list", icon: "pending_actions" },
        { code: "AMENU_CERTIFICATE_APPROVE", text: "인증서 승인", tEn: "Certificate Approval", u: "/admin/certificate/approve", icon: "approval" },
        { code: "AMENU_CERTIFICATE_REVIEW", text: "발급 검토", tEn: "Certificate Review", u: "/admin/certificate/review", icon: "fact_check" },
        { code: "AMENU_CERTIFICATE_STATISTICS", text: "인증서 통계", tEn: "Certificate Statistics", u: "/admin/certificate/statistics", icon: "query_stats" },
        { code: "AMENU_CERTIFICATE_REC_CHECK", text: "REC 중복 확인", tEn: "REC Duplicate Check", u: "/admin/certificate/rec_check", icon: "rule" },
        { code: "AMENU_CERTIFICATE_AUDIT", text: "인증서 감사 로그", tEn: "Certificate Audit Log", u: "/admin/certificate/audit-log", icon: "receipt_long" },
        { code: "AMENU_CERTIFICATE_OBJECTION", text: "이의신청 처리", tEn: "Objection Handling", u: "/admin/certificate/objection_list", icon: "gavel" }
      ] }
    ]
  },
  A004: {
    label: "콘텐츠·지원",
    labelEn: "Content & Support",
    summary: "게시판, 공지, 배너, 팝업, FAQ, 파일, 태그와 사이트맵을 관리합니다.",
    groups: [
      { title: "게시·공지", titleEn: "Publishing", icon: "article", links: [
        { code: "AMENU_BOARD_LIST", text: "게시판 관리", tEn: "Board Management", u: "/admin/content/board_list", icon: "view_list" },
        { code: "AMENU_BOARD_ADD", text: "공지 배포", tEn: "Publish Notice", u: "/admin/content/board_add", icon: "campaign" },
        { code: "AMENU_POST_LIST", text: "게시글 목록", tEn: "Post List", u: "/admin/content/post_list", icon: "article" }
      ] },
      { title: "노출 자산", titleEn: "Display Assets", icon: "web_asset", links: [
        { code: "AMENU_BANNER_LIST", text: "배너 목록", tEn: "Banners", u: "/admin/content/banner_list", icon: "view_carousel" },
        { code: "AMENU_BANNER_EDIT", text: "배너 편집", tEn: "Edit Banner", u: "/admin/content/banner_edit", icon: "edit" },
        { code: "AMENU_POPUP_LIST", text: "팝업 목록", tEn: "Popups", u: "/admin/content/popup_list", icon: "web_asset" },
        { code: "AMENU_POPUP_EDIT", text: "팝업 스케줄", tEn: "Popup Schedule", u: "/admin/content/popup_edit", icon: "schedule" }
      ] },
      { title: "지원 콘텐츠", titleEn: "Support Content", icon: "support_agent", links: [
        { code: "AMENU_QNA_CATEGORY", text: "Q&A 분류", tEn: "Q&A Category", u: "/admin/content/qna", icon: "category" },
        { code: "AMENU_FAQ_MANAGEMENT", text: "FAQ 관리", tEn: "FAQ Management", u: "/admin/content/faq_list", icon: "quiz" },
        { code: "AMENU_FAQ_MENU", text: "FAQ 메뉴 관리", tEn: "FAQ Menu", u: "/admin/content/menu", icon: "menu_book" },
        { code: "AMENU_FILE_MANAGEMENT", text: "파일 관리", tEn: "File Management", u: "/admin/content/file", icon: "folder" },
        { code: "AMENU_TAG_MANAGEMENT", text: "태그 관리", tEn: "Tag Management", u: "/admin/content/tag", icon: "sell" },
        { code: "AMENU_ADMIN_SITEMAP", text: "관리자 사이트맵", tEn: "Admin Sitemap", u: "/admin/content/sitemap", icon: "map" }
      ] }
    ]
  },
  A005: {
    label: "외부 연계",
    labelEn: "External Integration",
    summary: "외부 연결, 인증키, 스키마, 사용량, 로그, 웹훅, 동기화와 장애 재시도를 관리합니다.",
    groups: [
      { title: "연결 설정", titleEn: "Connection", icon: "hub", links: [
        { code: "AMENU_EXTERNAL_CONNECTION_LIST", text: "외부 연계 목록", tEn: "Connections", u: "/admin/external/connection_list", icon: "hub" },
        { code: "AMENU_EXTERNAL_KEYS", text: "외부 인증키 관리", tEn: "External Keys", u: "/admin/external/keys", icon: "key" },
        { code: "AMENU_EXTERNAL_SCHEMA", text: "외부 스키마", tEn: "External Schema", u: "/admin/external/schema", icon: "schema" },
        { code: "AMENU_EXTERNAL_WEBHOOKS", text: "웹훅 설정", tEn: "Webhooks", u: "/admin/external/webhooks", icon: "webhook" }
      ] },
      { title: "실행·관측", titleEn: "Execution & Observability", icon: "monitoring", links: [
        { code: "AMENU_EXTERNAL_SYNC", text: "동기화 실행", tEn: "Sync Execution", u: "/admin/external/sync", icon: "sync" },
        { code: "AMENU_EXTERNAL_MONITORING", text: "연계 모니터링", tEn: "Integration Monitoring", u: "/admin/external/monitoring", icon: "monitoring" },
        { code: "AMENU_EXTERNAL_USAGE", text: "API 사용량", tEn: "API Usage", u: "/admin/external/usage", icon: "data_usage" },
        { code: "AMENU_EXTERNAL_LOGS", text: "외부 연계 로그", tEn: "Integration Logs", u: "/admin/external/logs", icon: "receipt_long" },
        { code: "AMENU_EXTERNAL_MAINTENANCE", text: "점검 관리", tEn: "Maintenance", u: "/admin/external/maintenance", icon: "build" },
        { code: "AMENU_EXTERNAL_RETRY", text: "재시도 관리", tEn: "Retry Management", u: "/admin/external/retry", icon: "replay" }
      ] }
    ]
  },
  A006: {
    label: "시스템",
    labelEn: "System",
    summary: "메뉴, 화면, 빌더, 보안, 운영 모니터링, 백업과 시스템 자산을 관리합니다.",
    groups: [
      { title: "메뉴·화면·빌더", titleEn: "Menu, Screen & Builder", icon: "dashboard_customize", links: [
        { code: "AMENU_MENU_MANAGEMENT", text: "메뉴 관리", tEn: "Menu Management", u: "/admin/system/menu", icon: "menu" },
        { code: "AMENU_PAGE_MANAGEMENT", text: "페이지 관리", tEn: "Page Management", u: "/admin/system/page-management", icon: "web" },
        { code: "AMENU_SCREEN_MANAGEMENT", text: "화면 관리", tEn: "Screen Management", u: "/admin/system/screen-management", icon: "wysiwyg" },
        { code: "AMENU_SCREEN_FLOW", text: "화면 흐름 관리", tEn: "Screen Flow", u: "/admin/system/screen-flow-management", icon: "route" },
        { code: "AMENU_SCREEN_MENU_ASSIGN", text: "화면-메뉴 귀속 관리", tEn: "Screen Menu Assignment", u: "/admin/system/screen-menu-assignment-management", icon: "account_tree" },
        { code: "AMENU_BUILDER_STUDIO", text: "빌더 스튜디오", tEn: "Builder Studio", u: "/admin/system/builder-studio", icon: "design_services" },
        { code: "AMENU_SECTION_MANAGEMENT", text: "섹션 관리", tEn: "Section Management", u: "/admin/system/section-management", icon: "view_quilt" },
        { code: "AMENU_COMPONENT_MANAGEMENT", text: "컴포넌트 관리", tEn: "Component Management", u: "/admin/system/component-management", icon: "widgets" },
        { code: "AMENU_THEME_MANAGEMENT", text: "테마 관리", tEn: "Theme Management", u: "/admin/system/theme-management", icon: "palette" }
      ] },
      { title: "코드·기능·API", titleEn: "Code, Function & API", icon: "settings_applications", links: [
        { code: "AMENU_SYSTEM_CODE", text: "코드 조회", tEn: "Code Inquiry", u: "/admin/system/code", icon: "tag" },
        { code: "AMENU_FUNCTION_MANAGEMENT", text: "기능 관리", tEn: "Feature Management", u: "/admin/system/feature-management", icon: "toggle_on" },
        { code: "AMENU_FUNCTION_CONSOLE", text: "함수 콘솔", tEn: "Function Console", u: "/admin/system/function-console", icon: "terminal" },
        { code: "AMENU_API_MANAGEMENT", text: "API 관리", tEn: "API Management", u: "/admin/system/api-management", icon: "api" },
        { code: "AMENU_CONTROLLER_MANAGEMENT", text: "컨트롤러 관리", tEn: "Controller Management", u: "/admin/system/controller-management", icon: "account_tree" },
        { code: "AMENU_COLUMN_MANAGEMENT", text: "컬럼 관리", tEn: "Column Management", u: "/admin/system/column-management", icon: "view_column" },
        { code: "AMENU_MODULE", text: "모듈 관리", tEn: "Module Management", u: "/admin/system/module", icon: "extension" }
      ] },
      { title: "보안·로그", titleEn: "Security & Logs", icon: "security", links: [
        { code: "AMENU_SECURITY_POLICY", text: "보안 정책", tEn: "Security Policy", u: "/admin/system/security-policy", icon: "policy" },
        { code: "AMENU_SECURITY_MONITORING", text: "보안 모니터링", tEn: "Security Monitoring", u: "/admin/system/security-monitoring", icon: "monitor_heart" },
        { code: "AMENU_SECURITY_AUDIT", text: "보안 감사", tEn: "Security Audit", u: "/admin/system/security-audit", icon: "manage_search" },
        { code: "AMENU_BLOCKLIST", text: "차단 목록", tEn: "Blocklist", u: "/admin/system/blocklist", icon: "block" },
        { code: "AMENU_IP_WHITELIST", text: "IP 화이트리스트", tEn: "IP Whitelist", u: "/admin/system/ip_whitelist", icon: "shield" },
        { code: "AMENU_ACCESS_HISTORY", text: "접속 로그", tEn: "Access History", u: "/admin/system/access_history", icon: "login" },
        { code: "AMENU_ERROR_LOG", text: "에러 로그", tEn: "Error Log", u: "/admin/system/error-log", icon: "error" },
        { code: "AMENU_LOGIN_HISTORY", text: "로그인 이력", tEn: "Login History", u: "/admin/member/login_history", icon: "history" },
        { code: "AMENU_NOTIFICATION", text: "알림센터", tEn: "Notification Center", u: "/admin/system/notification", icon: "notifications" }
      ] },
      { title: "운영 모니터링", titleEn: "Operations Monitoring", icon: "monitoring", links: [
        { code: "AMENU_ADMIN_MONITORING", text: "모니터링 대시보드", tEn: "Monitoring Dashboard", u: "/admin/system/monitoring-dashboard", icon: "dashboard" },
        { code: "AMENU_CRON_MONITORING", text: "크론 모니터링", tEn: "Cron Monitoring", u: "/admin/system/cron-monitoring", icon: "schedule" },
        { code: "AMENU_DB_MONITORING", text: "DB 모니터링", tEn: "DB Monitoring", u: "/admin/system/db-monitoring", icon: "database" },
        { code: "AMENU_BATCH_MONITORING", text: "배치 모니터링", tEn: "Batch Monitoring", u: "/admin/system/batch-monitoring", icon: "factory" },
        { code: "AMENU_GIT_BUILD_MONITORING", text: "깃 빌드 모니터링", tEn: "Git Build Monitoring", u: "/admin/system/git-build-monitoring", icon: "account_tree" },
        { code: "AMENU_PERFORMANCE", text: "성능", tEn: "Performance", u: "/admin/system/performance", icon: "speed" },
        { code: "AMENU_INFRA", text: "인프라", tEn: "Infrastructure", u: "/admin/system/infra", icon: "dns" }
      ] },
      { title: "백업·런타임", titleEn: "Backup & Runtime", icon: "settings_backup_restore", links: [
        { code: "AMENU_BACKUP_CONFIG", text: "백업 설정", tEn: "Backup Config", u: "/admin/system/backup_config", icon: "backup" },
        { code: "AMENU_BACKUP_EXECUTION", text: "백업 실행", tEn: "Backup Execution", u: "/admin/system/backup", icon: "cloud_upload" },
        { code: "AMENU_RESTORE_EXECUTION", text: "복구 실행", tEn: "Restore Execution", u: "/admin/system/restore", icon: "restore" },
        { code: "AMENU_DB_PROMOTION", text: "DB 승격 정책", tEn: "DB Promotion Policy", u: "/admin/system/db-promotion-policy", icon: "swap_vert" },
        { code: "AMENU_DB_SYNC", text: "DB 동기화 배포", tEn: "DB Sync Deploy", u: "/admin/system/db-sync-deploy", icon: "sync_alt" },
        { code: "AMENU_VERSION_MANAGEMENT", text: "프로젝트 버전 관리", tEn: "Project Version", u: "/admin/system/version-management", icon: "commit" },
        { code: "AMENU_PACKAGE_GOVERNANCE", text: "패키지 거버넌스", tEn: "Package Governance", u: "/admin/system/package-governance", icon: "inventory_2" }
      ] }
    ]
  },
  A007: {
    label: "운영",
    labelEn: "Operations",
    summary: "관리자 운영 홈, 운영센터, 작업 요청, 자산 점검, 버전·복구 실행 흐름을 관리합니다.",
    groups: [
      { title: "운영 관제", titleEn: "Operations Control", icon: "dashboard", links: [
        { code: "AMENU_OPERATIONS_DASHBOARD", text: "운영 대시보드", tEn: "Operations Dashboard", u: "/admin/", icon: "dashboard" },
        { code: "AMENU_OPERATIONS_CENTER", text: "운영센터", tEn: "Operations Center", u: "/admin/monitoring/center", icon: "hub" },
        { code: "AMENU_SR_WORKBENCH", text: "SR 작업대", tEn: "SR Workbench", u: "/admin/system/sr-workbench", icon: "assignment" }
      ] },
      { title: "운영 자산", titleEn: "Operations Assets", icon: "inventory_2", links: [
        { code: "AMENU_ASSET_INVENTORY", text: "자산 인벤토리", tEn: "Asset Inventory", u: "/admin/system/asset-inventory", icon: "inventory_2" },
        { code: "AMENU_ASSET_DEFICIENCY", text: "자산 미흡 큐", tEn: "Asset Deficiency Queue", u: "/admin/system/asset-deficiency-queue", icon: "playlist_add_check" },
        { code: "AMENU_VERIFICATION_ASSET", text: "검증 자산 관리", tEn: "Verification Asset Management", u: "/admin/system/verification-asset-management", icon: "fact_check" }
      ] },
      { title: "버전·복구", titleEn: "Version & Recovery", icon: "settings_backup_restore", links: [
        { code: "AMENU_OPERATIONS_VERSION_MANAGEMENT", text: "프로젝트 버전 관리", tEn: "Project Version Management", u: "/admin/system/version-management", icon: "commit" },
        { code: "AMENU_REPAIR_WORKBENCH", text: "복구 작업대", tEn: "Repair Workbench", u: "/admin/system/repair-workbench", icon: "healing" },
        { code: "AMENU_CODEX_PROVISION", text: "Codex 실행 관리", tEn: "Codex Provision", u: "/admin/system/codex-provision", icon: "terminal" }
      ] }
    ]
  },
  A190: {
    label: "AI 운영",
    labelEn: "AI Operations",
    summary: "AI 모델, 에이전트, RAG, 작업 로그, 품질과 관측 기능을 관리합니다.",
    groups: [
      { title: "AI 관리", titleEn: "AI Management", icon: "smart_toy", links: [
        { code: "AMENU_AI_DASHBOARD", text: "AI 대시보드", tEn: "AI Dashboard", u: "/admin/ai/dashboard", icon: "dashboard" },
        { code: "AMENU_AI_MODELS", text: "모델 관리", tEn: "Models", u: "/admin/ai/models", icon: "memory" },
        { code: "AMENU_AI_AGENTS", text: "에이전트 관리", tEn: "Agents", u: "/admin/ai/agents", icon: "support_agent" },
        { code: "AMENU_AI_RAG", text: "RAG 관리", tEn: "RAG", u: "/admin/ai/rag", icon: "travel_explore" },
        { code: "AMENU_AI_TRAINING", text: "학습 관리", tEn: "Training", u: "/admin/ai/training", icon: "model_training" },
        { code: "AMENU_AI_QUALITY", text: "품질 관리", tEn: "Quality", u: "/admin/ai/quality", icon: "verified" },
        { code: "AMENU_AI_LOGS", text: "로그 관리", tEn: "Logs", u: "/admin/ai/logs", icon: "receipt_long" },
        { code: "AMENU_AI_OBSERVABILITY", text: "AI 관측", tEn: "Observability", u: "/admin/ai/observability", icon: "monitoring" },
        { code: "AMENU_HERMES_WORKFLOW", text: "Hermes 작업 기억", tEn: "Hermes Workflow", u: "/admin/system/hermes-workflow", icon: "psychology" }
      ] }
    ]
  }
};

export function getNormalizedAdminMenuTree(): AdminMenuTreePayload {
  return JSON.parse(JSON.stringify(ADMIN_DOMAIN_OVERRIDES)) as AdminMenuTreePayload;
}

export function getNormalizedHomeMenu(isEn = false): HomeMenuRecord[] {
  const menus = isEn ? HOME_MENU_EN : HOME_MENU_KO;
  return JSON.parse(JSON.stringify(menus)) as HomeMenuRecord[];
}

export function normalizeHomeEmissionMenu<T extends BootstrappedHomePayload | null | undefined>(payload: T): T {
  if (!payload) {
    return payload;
  }
  const nextMenu = getNormalizedHomeMenu(Boolean(payload.isEn));
  return { ...payload, homeMenu: nextMenu as Array<Record<string, unknown>> } as T;
}

export function normalizeAdminEmissionMenuTree(payload: AdminMenuTreePayload): AdminMenuTreePayload {
  return payload;
}
