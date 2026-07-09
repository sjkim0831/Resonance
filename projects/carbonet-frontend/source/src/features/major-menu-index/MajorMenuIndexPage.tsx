import { useEffect, useMemo, useState } from "react";
import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { useFrontendSession } from "../../app/hooks/useFrontendSession";
import { logGovernanceScope } from "../../app/policy/debug";
import { fetchHomePayload } from "../../lib/api/appBootstrap";
import { readBootstrappedHomePayload } from "../../lib/api/bootstrap";
import { buildLocalizedPath, getNavigationEventName, isEnglish, navigate } from "../../lib/navigation/runtime";
import {
  HeaderBrand,
  HeaderDesktopNav,
  HeaderMobileMenu
} from "../home-entry/HomeEntrySections";
import { LOCALIZED_CONTENT } from "../home-entry/homeEntryContent";
import { HomePayload } from "../home-entry/homeEntryTypes";

const GOV_SYMBOL = "/img/egovframework/kr_gov_symbol.png";
const GOV_SYMBOL_FALLBACK = "/img/egovframework/kr_gov_symbol.svg";

type HubSection = {
  title: string;
  subtitle: string;
  href: string;
  icon: string;
  metric: string;
  metricLabel: string;
  status: string;
  progress: number;
  features: string[];
  adminHref?: string;
  adminLabel?: string;
};

type HubConfig = {
  id: string;
  title: string;
  eyebrow: string;
  description: string;
  indexPath: string;
  indexPathEn: string;
  primaryHref: string;
  primaryLabel: string;
  secondaryHref: string;
  secondaryLabel: string;
  sections: HubSection[];
};

function handleGovSymbolError(event: React.SyntheticEvent<HTMLImageElement>) {
  const image = event.currentTarget;
  if (image.dataset.fallbackApplied === "1") {
    image.style.display = "none";
    return;
  }
  image.dataset.fallbackApplied = "1";
  image.src = GOV_SYMBOL_FALLBACK;
}

function MajorMenuIndexInlineStyles() {
  return (
    <style>{`
      :root {
        --kr-gov-blue: #00378b;
        --kr-gov-blue-hover: #002d72;
        --kr-gov-text-primary: #1a1a1a;
        --kr-gov-text-secondary: #4d4d4d;
        --kr-gov-border-light: #d9d9d9;
        --kr-gov-focus: #005fde;
        --kr-gov-bg-gray: #f2f2f2;
        --kr-gov-radius: 5px;
      }
      body {
        font-family: 'Noto Sans KR', 'Public Sans', sans-serif;
        -webkit-font-smoothing: antialiased;
      }
      .skip-link {
        position: absolute;
        top: -100px;
        left: 0;
        background: var(--kr-gov-blue);
        color: white;
        padding: 12px;
        z-index: 100;
        transition: top .2s ease;
      }
      .skip-link:focus { top: 0; }
      .material-symbols-outlined {
        font-variation-settings: 'wght' 400, 'opsz' 24;
        font-size: 24px;
      }
      .focus-visible:focus-visible {
        outline: 3px solid var(--kr-gov-focus);
        outline-offset: 2px;
      }
      .home-brand-copy { min-width: 0; }
      .home-brand-title {
        margin: 0 !important;
        font-size: inherit !important;
        line-height: 1.2 !important;
      }
      .home-brand-subtitle {
        margin: 0 !important;
        line-height: 1.2;
      }
      .gnb-item:hover .gnb-depth2 { display: block; }
      .gnb-depth2 { width: 560px !important; padding: 10px; }
      .gnb-sections { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
      .gnb-section { border: 1px solid #e5e7eb; border-radius: 6px; padding: 8px; background: #fafafa; }
      .gnb-section-title { display: block; font-size: 12px; font-weight: 700; color: var(--kr-gov-blue); margin-bottom: 6px; padding: 0 4px; }
      body.mobile-menu-open { overflow: hidden; }
    `}</style>
  );
}

function makeConfigs(en: boolean): Record<string, HubConfig> {
  return {
    monitoring: {
      id: "monitoring",
      eyebrow: en ? "Monitoring" : "모니터링",
      title: en ? "Monitoring Dashboard" : "모니터링 대시보드",
      description: en ? "Track live status, alerts, statistics, reports, and stakeholder sharing." : "실시간 상태, 경보, 통계, 리포트, 이해관계자 공유 기능을 한눈에 확인합니다.",
      indexPath: "/monitoring/index",
      indexPathEn: "/en/monitoring/index",
      primaryHref: buildLocalizedPath("/monitoring/dashboard", "/en/monitoring/dashboard"),
      primaryLabel: en ? "Open dashboard" : "대시보드 열기",
      secondaryHref: buildLocalizedPath("/monitoring/alerts", "/en/monitoring/alerts"),
      secondaryLabel: en ? "Check alerts" : "경보 확인",
      sections: [
        { title: en ? "Integrated Dashboard" : "통합 대시보드", subtitle: en ? "Executive KPIs and cross-site status." : "전체 KPI와 배출지별 상태를 확인합니다.", href: buildLocalizedPath("/monitoring/dashboard", "/en/monitoring/dashboard"), icon: "dashboard", metric: "21", metricLabel: en ? "sites" : "개 배출지", status: en ? "Live" : "실시간", progress: 92, features: en ? ["KPI", "Site trend", "Status map", "Drilldown"] : ["KPI", "배출지 추이", "상태 지도", "상세 이동"] },
        { title: en ? "Realtime Monitoring" : "실시간 모니터링", subtitle: en ? "Sensor and activity status stream." : "센서와 활동자료 상태를 실시간으로 확인합니다.", href: buildLocalizedPath("/monitoring/realtime", "/en/monitoring/realtime"), icon: "monitoring", metric: "98.2%", metricLabel: en ? "uptime" : "가동률", status: en ? "Normal" : "정상", progress: 98, features: en ? ["Live stream", "Signal", "Latency", "Collection"] : ["실시간 흐름", "신호", "지연", "수집"] },
        { title: en ? "Alerts" : "경보 현황", subtitle: en ? "Overdue, anomaly, and threshold alerts." : "지연, 이상치, 임계값 경보를 관리합니다.", href: buildLocalizedPath("/monitoring/alerts", "/en/monitoring/alerts"), icon: "notifications_active", metric: "6", metricLabel: en ? "open alerts" : "미해결 경보", status: en ? "Action" : "처리", progress: 67, features: en ? ["Severity", "Owner", "Deadline", "Resolution"] : ["심각도", "담당자", "마감", "조치"] },
        { title: en ? "ESG Report" : "ESG 보고서", subtitle: en ? "Monthly statistics and ESG disclosure summary." : "월별 통계와 ESG 공시 요약을 확인합니다.", href: buildLocalizedPath("/monitoring/statistics", "/en/monitoring/statistics"), icon: "bar_chart", metric: "14", metricLabel: en ? "reports" : "보고서", status: en ? "Ready" : "준비", progress: 80, features: en ? ["Statistics", "Disclosure", "Export", "Comparison"] : ["통계", "공시", "내보내기", "비교"] },
        { title: en ? "Stakeholder Share" : "이해관계자 공유", subtitle: en ? "Share approved dashboards and reports." : "승인된 대시보드와 보고서를 공유합니다.", href: buildLocalizedPath("/monitoring/share", "/en/monitoring/share"), icon: "share", metric: "9", metricLabel: en ? "groups" : "공유 그룹", status: en ? "Share" : "공유", progress: 75, features: en ? ["Recipients", "Permission", "Link", "Audit"] : ["수신자", "권한", "링크", "감사"] },
        { title: en ? "Reduction Trend" : "성과 추이 분석", subtitle: en ? "Target gap and reduction performance." : "목표 차이와 감축 성과를 분석합니다.", href: buildLocalizedPath("/monitoring/reduction_trend", "/en/monitoring/reduction_trend"), icon: "trending_down", metric: "-4.2%", metricLabel: en ? "YoY" : "전년 대비", status: en ? "Improving" : "개선", progress: 71, features: en ? ["Target gap", "Trend", "Forecast", "Cause"] : ["목표 차이", "추이", "예측", "원인"] },
        { title: en ? "Tracking Report" : "추적 리포트", subtitle: en ? "Trace evidence and report history." : "증빙과 보고 이력을 추적합니다.", href: buildLocalizedPath("/monitoring/track", "/en/monitoring/track"), icon: "route", metric: "128", metricLabel: en ? "records" : "추적 기록", status: en ? "Trace" : "추적", progress: 86, features: en ? ["Evidence", "History", "Hash", "Reviewer"] : ["증빙", "이력", "해시", "검토자"] },
        { title: en ? "Report Export" : "분석 리포트 내보내기", subtitle: en ? "Download analysis packages." : "분석 보고서 묶음을 내려받습니다.", href: buildLocalizedPath("/monitoring/export", "/en/monitoring/export"), icon: "download", metric: "4", metricLabel: en ? "ready" : "준비 완료", status: en ? "Export" : "내보내기", progress: 78, features: en ? ["PDF", "Excel", "Evidence", "Schedule"] : ["PDF", "엑셀", "증빙", "예약"] }
      ]
    },
    co2: {
      id: "co2",
      eyebrow: en ? "MRV & Carbon Market" : "MRV·탄소시장",
      title: en ? "MRV and Carbon Market Dashboard" : "MRV·탄소시장 대시보드",
      description: en ? "Monitor production, demand, integrity, credit, quality, and MRV search." : "생산·수요·무결성·크레딧·품질·MRV 조회 상태를 확인합니다.",
      indexPath: "/co2/index",
      indexPathEn: "/en/co2/index",
      primaryHref: buildLocalizedPath("/co2/search", "/en/co2/search"),
      primaryLabel: en ? "Search MRV" : "MRV 검색",
      secondaryHref: buildLocalizedPath("/co2/integrity", "/en/co2/integrity"),
      secondaryLabel: en ? "Check integrity" : "무결성 확인",
      sections: [
        { title: en ? "Production Info" : "생산 정보", subtitle: en ? "Track production-linked carbon records." : "생산 기반 탄소 기록을 확인합니다.", href: buildLocalizedPath("/co2/production_list", "/en/co2/production_list"), icon: "factory", metric: "42", metricLabel: en ? "batches" : "생산 묶음", status: en ? "Active" : "운영", progress: 82, features: en ? ["Batch", "Volume", "Origin", "Evidence"] : ["배치", "물량", "출처", "증빙"] },
        { title: en ? "Demand Info" : "수요 정보", subtitle: en ? "Monitor buyer demand and matching readiness." : "구매 수요와 매칭 준비도를 확인합니다.", href: buildLocalizedPath("/co2/demand_list", "/en/co2/demand_list"), icon: "request_quote", metric: "17", metricLabel: en ? "requests" : "수요", status: en ? "Matching" : "매칭", progress: 68, features: en ? ["Buyer", "Quantity", "Price", "Deadline"] : ["구매자", "수량", "가격", "마감"] },
        { title: en ? "Integrity Tracking" : "무결성 추적", subtitle: en ? "Check duplicate and traceability risk." : "중복과 추적성 위험을 점검합니다.", href: buildLocalizedPath("/co2/integrity", "/en/co2/integrity"), icon: "verified_user", metric: "2", metricLabel: en ? "risks" : "위험", status: en ? "Review" : "검토", progress: 91, features: en ? ["Duplicate", "Trace", "Hash", "Evidence"] : ["중복", "추적", "해시", "증빙"] },
        { title: en ? "Carbon Credit" : "탄소 크레딧", subtitle: en ? "Review credit conversion and status." : "크레딧 전환과 상태를 확인합니다.", href: buildLocalizedPath("/co2/credit", "/en/co2/credit"), icon: "token", metric: "8,420", metricLabel: en ? "credits" : "크레딧", status: en ? "Issued" : "발급", progress: 74, features: en ? ["Issue", "Transfer", "Retire", "Audit"] : ["발급", "이전", "상쇄", "감사"] },
        { title: en ? "Quality Metrics" : "품질 지표", subtitle: en ? "Measure quality of carbon records." : "탄소 기록 품질을 측정합니다.", href: buildLocalizedPath("/co2/analysis", "/en/co2/analysis"), icon: "query_stats", metric: "96.1%", metricLabel: en ? "quality" : "품질", status: en ? "Good" : "양호", progress: 96, features: en ? ["Completeness", "Accuracy", "Timeliness", "Risk"] : ["완전성", "정확성", "적시성", "위험"] },
        { title: en ? "MRV Information" : "MRV 정보", subtitle: en ? "Search verifiable MRV records." : "검증 가능한 MRV 기록을 검색합니다.", href: buildLocalizedPath("/co2/search", "/en/co2/search"), icon: "search", metric: "328", metricLabel: en ? "records" : "기록", status: en ? "Search" : "조회", progress: 88, features: en ? ["MRV", "Evidence", "Certificate", "Export"] : ["MRV", "증빙", "인증서", "내보내기"] },
        { title: en ? "Market Handoff" : "시장 연계", subtitle: en ? "Connect eligible credits to trading." : "거래 가능한 크레딧을 시장으로 연결합니다.", href: buildLocalizedPath("/trade/market", "/en/trade/market"), icon: "storefront", metric: "11", metricLabel: en ? "eligible" : "거래 가능", status: en ? "Ready" : "준비", progress: 70, features: en ? ["Eligibility", "Listing", "Price", "Order"] : ["자격", "상장", "가격", "주문"] },
        { title: en ? "Credit Report" : "크레딧 리포트", subtitle: en ? "Package MRV and credit evidence." : "MRV와 크레딧 증빙을 묶습니다.", href: buildLocalizedPath("/monitoring/export", "/en/monitoring/export"), icon: "summarize", metric: "5", metricLabel: en ? "packages" : "패키지", status: en ? "Report" : "보고", progress: 76, features: en ? ["Package", "PDF", "History", "Share"] : ["패키지", "PDF", "이력", "공유"] }
      ]
    }
  };
}

function extendConfigs(en: boolean): Record<string, HubConfig> {
  const configs = makeConfigs(en);
  configs.trade = buildSimpleConfig(en, "trade", en ? "Trade" : "거래", en ? "Trade Dashboard" : "거래 대시보드", en ? "Monitor listing, market, orders, settlement, and alerts." : "거래 목록, 시장, 주문, 체결, 알림 흐름을 확인합니다.", "/trade/index", "/en/trade/index", [
    ["거래 목록", "trade/list", "list_alt", "24", ["목록", "상태", "상대방", "이력"]],
    ["거래 시장", "trade/market", "storefront", "18", ["호가", "가격", "수요", "공급"]],
    ["구매 요청", "trade/buy_request", "shopping_cart", "7", ["요청", "수량", "조건", "마감"]],
    ["판매 등록", "trade/sell", "sell", "5", ["등록", "가격", "증빙", "공개"]],
    ["체결 현황", "trade/complete", "handshake", "12", ["체결", "정산", "상태", "문서"]],
    ["자동 매칭", "trade/auto_order", "sync_alt", "3", ["규칙", "매칭", "우선순위", "결과"]],
    ["가격 알림", "trade/price_alert", "notifications", "9", ["알림", "조건", "가격", "수신"]],
    ["거래 리포트", "trade/report", "assessment", "6", ["통계", "성과", "정산", "내보내기"]]
  ]);
  configs.payment = buildSimpleConfig(en, "payment", en ? "Payment" : "결제", en ? "Payment Dashboard" : "결제 대시보드", en ? "Monitor payment request, virtual account, refund, tax invoice, and receipt." : "결제 요청, 가상계좌, 환불, 세금계산서, 영수증을 확인합니다.", "/payment/index", "/en/payment/index", [
    ["결제 요청", "payment/pay", "payments", "8", ["요청", "금액", "승인", "상태"]],
    ["가상계좌", "payment/virtual_account", "account_balance", "6", ["계좌", "입금", "만료", "확인"]],
    ["결제 환불", "payment/refund", "currency_exchange", "3", ["환불", "사유", "승인", "처리"]],
    ["환불 계좌", "payment/refund_account", "account_balance_wallet", "4", ["계좌", "검증", "예금주", "상태"]],
    ["세금계산서", "payment/notify", "receipt_long", "11", ["발행", "전송", "오류", "재발행"]],
    ["결제 내역", "payment/history", "history", "42", ["내역", "검색", "필터", "다운로드"]],
    ["영수증 관리", "payment/receipt", "receipt", "19", ["영수증", "출력", "재발급", "공유"]],
    ["정산 캘린더", "admin/payment/settlement", "event", "2", ["정산", "마감", "일정", "담당"]]
  ]);
  configs.certificate = buildSimpleConfig(en, "certificate", en ? "Certificate" : "인증서", en ? "Certificate Dashboard" : "인증서 대시보드", en ? "Monitor certificate applications, reports, review, issue, and audit." : "인증서 신청, 보고서, 검토, 발급, 감사 상태를 확인합니다.", "/certificate/index", "/en/certificate/index", [
    ["인증서 목록", "certificate/list", "workspace_premium", "16", ["목록", "상태", "만료", "출력"]],
    ["인증서 신청", "certificate/apply", "post_add", "5", ["신청", "첨부", "검토", "접수"]],
    ["보고서 목록", "certificate/report_list", "folder_copy", "8", ["보고서", "상태", "PDF", "제출"]],
    ["보고서 작성", "certificate/report_form", "edit_document", "3", ["작성", "임시저장", "검증", "제출"]],
    ["보고서 수정", "certificate/report_edit", "edit_note", "2", ["수정", "사유", "이력", "재제출"]],
    ["발급 검토", "admin/certificate/review", "fact_check", "7", ["검토", "승인", "반려", "의견"]],
    ["인증서 통계", "admin/certificate/statistics", "bar_chart", "12", ["통계", "추이", "유형", "다운로드"]],
    ["감사 로그", "admin/certificate/audit-log", "policy", "128", ["로그", "사용자", "변경", "추적"]]
  ]);
  configs.edu = buildSimpleConfig(en, "edu", en ? "Education" : "교육", en ? "Education Dashboard" : "교육 대시보드", en ? "Monitor courses, applications, progress, surveys, and certificates." : "교육과정, 신청, 진도, 설문, 수료증을 확인합니다.", "/edu/index", "/en/edu/index", [
    ["교육과정 목록", "edu/course_list", "school", "12", ["과정", "분류", "모집", "상세"]],
    ["과정 상세", "edu/course_detail", "menu_book", "8", ["커리큘럼", "강사", "일정", "신청"]],
    ["교육 신청", "edu/apply", "how_to_reg", "5", ["신청", "승인", "대기", "취소"]],
    ["나의 교육", "edu/my_course", "person_book", "4", ["수강", "진도", "과제", "수료"]],
    ["진도 관리", "edu/progress", "trending_up", "72%", ["진도", "출석", "평가", "완료"]],
    ["자격 연계", "edu/content", "hub", "3", ["자격", "연계", "콘텐츠", "추천"]],
    ["설문조사", "edu/survey", "assignment", "6", ["설문", "응답", "결과", "분석"]],
    ["수료증", "edu/certificate", "workspace_premium", "9", ["수료", "발급", "출력", "검증"]]
  ]);
  configs.support = buildSimpleConfig(en, "support", en ? "Support" : "고객지원", en ? "Support Dashboard" : "고객지원 대시보드", en ? "Monitor notices, FAQ, downloads, inquiries, and search." : "공지, FAQ, 자료실, 문의, 검색 상태를 확인합니다.", "/support/index", "/en/support/index", [
    ["공지사항", "support/notice_list", "campaign", "14", ["공지", "중요", "검색", "첨부"]],
    ["FAQ", "support/faq", "quiz", "32", ["FAQ", "분류", "검색", "도움"]],
    ["자료실", "support/download_list", "download", "28", ["자료", "파일", "버전", "다운로드"]],
    ["지원 통합검색", "support/qna_list", "search", "86", ["검색", "Q&A", "태그", "결과"]],
    ["문의 내역", "support/inquiry", "support_agent", "5", ["문의", "답변", "상태", "첨부"]],
    ["1:1 문의", "mtn/my_inquiry", "contact_support", "2", ["등록", "분류", "답변", "이력"]],
    ["서비스 상태", "mtn/status", "monitor_heart", "99.9%", ["상태", "점검", "장애", "공지"]],
    ["사이트맵", "sitemap", "account_tree", "80+", ["메뉴", "검색", "이동", "권한"]]
  ]);
  configs.mtn = buildSimpleConfig(en, "mtn", en ? "Service Desk" : "서비스 운영", en ? "Service Operations Dashboard" : "서비스 운영 대시보드", en ? "Monitor inquiries, service status, versions, and support handoff." : "문의, 서비스 상태, 버전, 지원 연계를 확인합니다.", "/mtn/index", "/en/mtn/index", [
    ["1:1 문의", "mtn/my_inquiry", "contact_support", "5", ["문의", "답변", "상태", "첨부"]],
    ["서비스 상태", "mtn/status", "monitor_heart", "99.9%", ["가동", "점검", "장애", "이력"]],
    ["버전 관리", "mtn/version", "deployed_code", "10", ["버전", "배포", "비교", "복구"]],
    ["FAQ", "support/faq", "quiz", "32", ["질문", "답변", "분류", "추천"]],
    ["공지사항", "support/notice_list", "campaign", "14", ["공지", "점검", "장애", "이벤트"]],
    ["자료실", "support/download_list", "download", "28", ["파일", "가이드", "양식", "다운로드"]],
    ["문의 내역", "support/inquiry", "support_agent", "7", ["문의", "답변", "상태", "담당"]],
    ["지원 검색", "support/qna_list", "search", "86", ["검색", "Q&A", "태그", "결과"]]
  ]);
  configs.mypage = buildSimpleConfig(en, "mypage", en ? "My Page" : "마이페이지", en ? "My Page Dashboard" : "마이페이지 대시보드", en ? "Monitor profile, company, security, notification, and staff settings." : "프로필, 기업, 보안, 알림, 담당자 설정을 확인합니다.", "/mypage/index", "/en/mypage/index", [
    ["마이페이지", "mypage/profile", "person", "완료", ["프로필", "권한", "상태", "요약"]],
    ["이메일/전화 변경", "mypage/email", "alternate_email", "1", ["이메일", "전화", "인증", "변경"]],
    ["알림 설정", "mypage/notification", "notifications", "6", ["채널", "수신", "업무", "경보"]],
    ["마케팅 수신", "mypage/marketing", "mark_email_read", "2", ["동의", "철회", "이력", "채널"]],
    ["기업 정보", "mypage/company", "business", "1", ["기업", "사업자", "주소", "담당"]],
    ["비밀번호 변경", "mypage/password", "lock_reset", "90일", ["비밀번호", "정책", "이력", "보안"]],
    ["담당자 관리", "mypage/staff", "groups", "4", ["담당자", "권한", "초대", "비활성"]],
    ["로그인 이력", "admin/member/login-history", "history", "12", ["로그인", "IP", "기기", "위험"]]
  ]);
  return configs;
}

function buildSimpleConfig(en: boolean, id: string, eyebrow: string, title: string, description: string, indexPath: string, indexPathEn: string, rows: Array<[string, string, string, string, string[]]>): HubConfig {
  const sections = rows.map(([titleKo, path, icon, metric, features], index) => {
    const href = path.startsWith("admin/")
      ? buildLocalizedPath(`/${path}`, `/en/${path}`)
      : buildLocalizedPath(`/${path}`, `/en/${path}`);
    return {
      title: titleKo,
      subtitle: `${titleKo} ${en ? "status and key actions." : "상태와 주요 기능을 확인합니다."}`,
      href,
      icon,
      metric,
      metricLabel: en ? "items" : "항목",
      status: index % 3 === 0 ? (en ? "Action" : "처리") : index % 3 === 1 ? (en ? "Ready" : "준비") : (en ? "Monitor" : "확인"),
      progress: Math.max(42, 92 - index * 6),
      features,
      adminHref: index < 4 ? undefined : href,
      adminLabel: en ? "Admin link" : "관리 링크"
    };
  });
  return {
    id,
    eyebrow,
    title,
    description,
    indexPath,
    indexPathEn,
    primaryHref: sections[0]?.href || indexPath,
    primaryLabel: en ? "Continue work" : "업무 계속하기",
    secondaryHref: sections[1]?.href || indexPath,
    secondaryLabel: en ? "Open key screen" : "주요 화면 열기",
    sections
  };
}

function MajorMenuIndexPage({ configKey }: { configKey: string }) {
  const en = isEnglish();
  const session = useFrontendSession();
  const content = LOCALIZED_CONTENT[en ? "en" : "ko"];
  const initialPayload = useMemo(() => readBootstrappedHomePayload() as HomePayload | null, []);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const payloadState = useAsyncValue<HomePayload>(
    () => fetchHomePayload(),
    [en],
    {
      initialValue: initialPayload || { isLoggedIn: false, isEn: en, homeMenu: [] },
      onError: () => undefined
    }
  );

  useEffect(() => {
    document.body.classList.toggle("mobile-menu-open", mobileMenuOpen);
    return () => document.body.classList.remove("mobile-menu-open");
  }, [mobileMenuOpen]);

  useEffect(() => {
    function handleNavigationSync() {
      void payloadState.reload();
      void session.reload();
    }
    window.addEventListener(getNavigationEventName(), handleNavigationSync);
    return () => window.removeEventListener(getNavigationEventName(), handleNavigationSync);
  }, [payloadState, session]);

  const payload = payloadState.value || { isLoggedIn: false, isEn: en, homeMenu: [] };
  const homeMenu = payload.homeMenu || [];
  const configs = useMemo(() => extendConfigs(en), [en]);
  const config = configs[configKey] || configs.monitoring;
  const overallProgress = Math.round(config.sections.reduce((sum, section) => sum + section.progress, 0) / config.sections.length);

  useEffect(() => {
    logGovernanceScope("PAGE", `${config.id}-index`, {
      language: en ? "en" : "ko",
      mobileMenuOpen,
      menuCount: homeMenu.length,
      isLoggedIn: Boolean(payload.isLoggedIn),
      sectionCount: config.sections.length,
      overallProgress
    });
  }, [config.id, config.sections.length, en, homeMenu.length, mobileMenuOpen, overallProgress, payload.isLoggedIn]);

  return (
    <>
      <MajorMenuIndexInlineStyles />
      <div className="bg-[#f4f7fa] text-[var(--kr-gov-text-primary)]">
        <a className="skip-link" href="#main-content">{en ? "Skip to content" : "본문 바로가기"}</a>
        <div className="bg-[var(--kr-gov-bg-gray)] border-b border-[var(--kr-gov-border-light)]">
          <div className="max-w-[1440px] mx-auto px-4 lg:px-8 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <img alt={en ? "Government symbol" : "대한민국 정부 상징"} className="h-4" data-fallback-applied="0" onError={handleGovSymbolError} src={GOV_SYMBOL} />
              <span className="text-[12px] font-medium text-[var(--kr-gov-text-secondary)]">{en ? "Official Government Service | Menu Dashboard" : "대한민국 정부 공식 서비스 | 대메뉴 대시보드"}</span>
            </div>
            <p className="hidden md:block text-xs font-medium text-[var(--kr-gov-text-secondary)]">{en ? "Last update: just now" : "마지막 업데이트: 방금 전"}</p>
          </div>
        </div>
        <header className="bg-white border-b border-[var(--kr-gov-border-light)] sticky top-0 z-50 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 lg:px-8">
            <div className="relative flex items-center h-24">
              <div className="xl:hidden w-11 h-11 shrink-0" aria-hidden="true" />
              <HeaderBrand content={content} en={en} />
              <HeaderDesktopNav en={en} homeMenu={homeMenu} />
              <div className={`ml-auto flex items-center ${en ? "gap-2" : "gap-3"} shrink-0`}>
                <div className="hidden xl:flex border border-[var(--kr-gov-border-light)] rounded-[var(--kr-gov-radius)] overflow-hidden">
                  <button type="button" className={`px-2 py-1 text-xs font-bold focus-visible ${en ? "bg-white text-[var(--kr-gov-text-secondary)] hover:bg-gray-100" : "bg-[var(--kr-gov-blue)] text-white"}`} onClick={() => navigate(config.indexPath)}>KO</button>
                  <button type="button" className={`px-2 py-1 text-xs font-bold focus-visible border-l border-[var(--kr-gov-border-light)] ${en ? "bg-[var(--kr-gov-blue)] text-white" : "bg-white text-[var(--kr-gov-text-secondary)] hover:bg-gray-100"}`} onClick={() => navigate(config.indexPathEn)}>EN</button>
                </div>
                {payload.isLoggedIn ? (
                  <button type="button" className="hidden xl:inline-flex px-5 py-2.5 font-bold rounded-[var(--kr-gov-radius)] transition-colors focus-visible outline-none bg-[var(--kr-gov-blue)] text-white hover:bg-[var(--kr-gov-blue-hover)]" onClick={() => void session.logout()}>{content.logout}</button>
                ) : (
                  <>
                    <a className="hidden xl:inline-flex px-5 py-2.5 font-bold rounded-[var(--kr-gov-radius)] transition-colors focus-visible outline-none bg-[var(--kr-gov-blue)] text-white hover:bg-[var(--kr-gov-blue-hover)] items-center" href={buildLocalizedPath("/signin/loginView", "/en/signin/loginView")}>{content.login}</a>
                    <a className="hidden xl:inline-flex px-5 py-2.5 font-bold rounded-[var(--kr-gov-radius)] transition-colors focus-visible outline-none bg-white text-[var(--kr-gov-blue)] border border-[var(--kr-gov-blue)] hover:bg-[var(--kr-gov-bg-gray)] items-center" href={buildLocalizedPath("/join/step1", "/join/en/step1")}>{content.signup}</a>
                  </>
                )}
                <button id="mobile-menu-toggle" className="xl:hidden w-11 h-11 rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] text-[var(--kr-gov-blue)] flex items-center justify-center hover:bg-[var(--kr-gov-bg-gray)] focus-visible" type="button" aria-controls="mobile-menu" aria-expanded={mobileMenuOpen} aria-label={content.openAllMenu} onClick={() => setMobileMenuOpen((current) => !current)}>
                  <span className="material-symbols-outlined">menu</span>
                </button>
              </div>
            </div>
          </div>
        </header>
        <div id="mobile-menu" className={`${mobileMenuOpen ? "" : "hidden"} xl:hidden fixed inset-0 z-[70]`} aria-hidden={!mobileMenuOpen}>
          <button type="button" id="mobile-menu-backdrop" className="absolute inset-0 bg-black/50" aria-label={content.closeAllMenu} onClick={() => setMobileMenuOpen(false)} />
          <HeaderMobileMenu content={content} en={en} homeMenu={homeMenu} isLoggedIn={Boolean(payload.isLoggedIn)} onClose={() => setMobileMenuOpen(false)} onLogout={session.logout} />
        </div>
        <main id="main-content">
          <section className="border-b border-slate-200 bg-white">
            <div className="max-w-[1440px] mx-auto px-4 lg:px-8 py-8">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--kr-gov-blue)]">{config.eyebrow}</p>
                  <h1 className="mt-2 text-3xl font-black tracking-tight text-gray-900">{config.title}</h1>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--kr-gov-text-secondary)]">{config.description}</p>
                </div>
                <div className="grid grid-cols-3 gap-3 sm:min-w-[420px]">
                  <div className="rounded-xl border border-gray-100 bg-slate-50 p-4">
                    <p className="text-xs font-bold text-gray-500">{en ? "Overall" : "전체 진행"}</p>
                    <p className="mt-1 text-2xl font-black text-gray-900">{overallProgress}%</p>
                  </div>
                  <div className="rounded-xl border border-orange-100 bg-orange-50 p-4">
                    <p className="text-xs font-bold text-orange-700">{en ? "Actions" : "처리 업무"}</p>
                    <p className="mt-1 text-2xl font-black text-orange-700">{Math.ceil(config.sections.length / 2)}</p>
                  </div>
                  <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4">
                    <p className="text-xs font-bold text-emerald-700">{en ? "Screens" : "화면"}</p>
                    <p className="mt-1 text-2xl font-black text-emerald-700">{config.sections.length}</p>
                  </div>
                </div>
              </div>
              <div className="mt-6 flex flex-wrap gap-2">
                <a className="inline-flex items-center gap-2 rounded-lg bg-[var(--kr-gov-blue)] px-5 py-3 text-sm font-black text-white hover:bg-[var(--kr-gov-blue-hover)]" href={config.primaryHref}>
                  <span className="material-symbols-outlined text-[18px]">play_arrow</span>
                  {config.primaryLabel}
                </a>
                <a className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-5 py-3 text-sm font-black text-gray-700 hover:bg-gray-50" href={config.secondaryHref}>
                  <span className="material-symbols-outlined text-[18px]">open_in_new</span>
                  {config.secondaryLabel}
                </a>
              </div>
            </div>
          </section>
          <section className="max-w-[1440px] mx-auto px-4 lg:px-8 py-8" data-help-id={`${config.id}-index-dashboard`}>
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              {config.sections.map((section) => (
                <article className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md" key={section.title}>
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex items-start gap-4">
                      <span className="material-symbols-outlined flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[var(--kr-gov-blue)]">{section.icon}</span>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-lg font-black text-gray-900">{section.title}</h2>
                          <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-black text-blue-700">{section.status}</span>
                        </div>
                        <p className="mt-1 text-sm leading-6 text-gray-500">{section.subtitle}</p>
                      </div>
                    </div>
                    <div className="shrink-0 rounded-xl bg-slate-50 px-4 py-3 text-right">
                      <p className="text-2xl font-black text-gray-900">{section.metric}</p>
                      <p className="text-[11px] font-bold text-gray-500">{section.metricLabel}</p>
                    </div>
                  </div>
                  <div className="mt-5">
                    <div className="mb-2 flex justify-between text-xs font-bold text-gray-500">
                      <span>{en ? "Readiness" : "준비도"}</span>
                      <span>{section.progress}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                      <div className="h-full rounded-full bg-[var(--kr-gov-blue)]" style={{ width: `${section.progress}%` }} />
                    </div>
                  </div>
                  <div className="mt-5 grid grid-cols-2 gap-2">
                    {section.features.map((feature) => (
                      <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs font-bold text-gray-600" key={`${section.title}-${feature}`}>
                        <span className="material-symbols-outlined text-[15px] text-emerald-600">check_circle</span>
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-5 flex flex-wrap gap-2">
                    <a className="inline-flex items-center gap-2 rounded-lg bg-[var(--kr-gov-blue)] px-4 py-2.5 text-xs font-black text-white hover:bg-[var(--kr-gov-blue-hover)]" href={section.href}>
                      {en ? "Open screen" : "화면 열기"}
                      <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                    </a>
                    {section.adminHref ? (
                      <a className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-xs font-black text-gray-600 hover:bg-gray-50" href={section.adminHref}>
                        <span className="material-symbols-outlined text-[16px]">admin_panel_settings</span>
                        {section.adminLabel}
                      </a>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          </section>
        </main>
      </div>
    </>
  );
}

export function MonitoringIndexPage() { return <MajorMenuIndexPage configKey="monitoring" />; }
export function Co2IndexPage() { return <MajorMenuIndexPage configKey="co2" />; }
export function TradeIndexPage() { return <MajorMenuIndexPage configKey="trade" />; }
export function PaymentIndexPage() { return <MajorMenuIndexPage configKey="payment" />; }
export function CertificateIndexPage() { return <MajorMenuIndexPage configKey="certificate" />; }
export function EduIndexPage() { return <MajorMenuIndexPage configKey="edu" />; }
export function SupportIndexPage() { return <MajorMenuIndexPage configKey="support" />; }
export function MtnIndexPage() { return <MajorMenuIndexPage configKey="mtn" />; }
export function MypageIndexPage() { return <MajorMenuIndexPage configKey="mypage" />; }
