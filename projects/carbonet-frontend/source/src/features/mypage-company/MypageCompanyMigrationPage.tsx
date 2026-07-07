import { useMemo } from "react";
import { useFrontendSession } from "../../app/hooks/useFrontendSession";
import { logGovernanceScope } from "../../app/policy/debug";
import {
  UserGovernmentBar,
  UserLanguageToggle,
  UserPortalFooter,
  UserPortalHeader
} from "../../components/user-shell/UserPortalChrome";
import { buildLocalizedPath, isEnglish, navigate } from "../../lib/navigation/runtime";
import { HomeButton, HomeInput } from "../home-ui/common";

type CopySet = {
  skip: string;
  government: string;
  guideline: string;
  title: string;
  subtitle: string;
  tabProfile: string;
  tabCompany: string;
  searchPlaceholder: string;
  searchButton: string;
  editRequest: string;
  companyCardTitle: string;
  companyCardRole: string;
  companyCardSites: string;
  companyCardStatus: string;
  activityTitle: string;
  activityViewAll: string;
  basicInfoTitle: string;
  basicInfoDescription: string;
  siteSummaryTitle: string;
  contactTitle: string;
  documentsTitle: string;
  roadmapTitle: string;
  complianceTitle: string;
  footerOrg: string;
  footerAddress: string;
  footerLinks: string[];
  footerCopyright: string;
  footerLastModifiedLabel: string;
  footerWaAlt: string;
  footerServiceLine: string;
};

const COPY: Record<"ko" | "en", CopySet> = {
  ko: {
    skip: "본문 바로가기",
    government: "대한민국 정부 공식 서비스",
    guideline: "이 누리집은 2025 디지털 정부 UI/UX 가이드라인을 준수합니다.",
    title: "기업 정보",
    subtitle: "법인 정보, 연계 사업장, 담당자 및 제출 문서를 한 곳에서 관리합니다.",
    tabProfile: "개인 프로필",
    tabCompany: "기업 정보",
    searchPlaceholder: "사업자번호, 법인명, 담당자명으로 검색",
    searchButton: "조회",
    editRequest: "정보 수정 요청",
    companyCardTitle: "(주) 탄소에너지솔루션",
    companyCardRole: "회원사 총괄 관리자",
    companyCardSites: "연계 사업장 21개소",
    companyCardStatus: "법정 증빙 최신 상태 유지",
    activityTitle: "최근 변경 이력",
    activityViewAll: "전체 이력 보기",
    basicInfoTitle: "조직 기본 정보",
    basicInfoDescription: "기업 식별 정보와 법정 증빙 기준 정보를 확인합니다.",
    siteSummaryTitle: "연계 사업장 요약",
    contactTitle: "담당자 및 권한 현황",
    documentsTitle: "제출 문서 현황",
    roadmapTitle: "갱신 일정",
    complianceTitle: "컴플라이언스 메모",
    footerOrg: "CCUS 통합관리본부",
    footerAddress: "(04551) 서울특별시 중구 세종대로 110 | 대표전화: 02-1234-5678 (평일 09:00~18:00)",
    footerLinks: ["개인정보처리방침", "이용약관", "사이트맵", "이메일무단수집거부"],
    footerCopyright: "© 2025 CCUS Carbon Footprint Platform. All rights reserved.",
    footerLastModifiedLabel: "최종 수정일:",
    footerWaAlt: "웹 접근성 품질인증 마크",
    footerServiceLine: "본 서비스는 관계 법령에 의거하여 온실가스 감축 성과를 관리합니다."
  },
  en: {
    skip: "Skip to main content",
    government: "Official Website of the Republic of Korea",
    guideline: "This website complies with the 2025 Digital Government UI/UX Guidelines.",
    title: "Company Information",
    subtitle: "Manage corporate records, linked sites, responsible staff, and submitted documents in one place.",
    tabProfile: "My Profile",
    tabCompany: "Company Info",
    searchPlaceholder: "Search by business number, company name, or manager",
    searchButton: "Search",
    editRequest: "Request Update",
    companyCardTitle: "Carbon Energy Solutions Co., Ltd.",
    companyCardRole: "Corporate Master Admin",
    companyCardSites: "21 linked sites",
    companyCardStatus: "Statutory documents up to date",
    activityTitle: "Recent Activity",
    activityViewAll: "View all activity",
    basicInfoTitle: "Organizational Details",
    basicInfoDescription: "Review company identifiers and statutory evidence records.",
    siteSummaryTitle: "Linked Site Summaries",
    contactTitle: "Contacts & Permissions",
    documentsTitle: "Submitted Documents",
    roadmapTitle: "Renewal Roadmap",
    complianceTitle: "Compliance Notes",
    footerOrg: "CCUS Integrated Management Office",
    footerAddress: "(04551) 110 Sejong-daero, Jung-gu, Seoul, Korea | Main Contact: 02-1234-5678 (Weekdays 09:00~18:00)",
    footerLinks: ["Privacy Policy", "Terms of Use", "Sitemap", "Email Collection Refusal"],
    footerCopyright: "© 2025 CCUS Carbon Footprint Platform. All rights reserved.",
    footerLastModifiedLabel: "Last Modified:",
    footerWaAlt: "Web Accessibility Quality Mark",
    footerServiceLine: "This service manages greenhouse gas reduction performance in accordance with relevant laws."
  }
};

const COMPANY_FIELDS = {
  ko: [
    { label: "기업 법인명", value: "(주) 탄소에너지솔루션" },
    { label: "사업자 등록번호", value: "123-86-09874" },
    { label: "대표자 성명", value: "홍길동" },
    { label: "법인 등록번호", value: "110111-1234567" },
    { label: "본사 소재지", value: "서울특별시 중구 세종대로 110 (태평로1가)" },
    { label: "업종", value: "탄소 데이터 서비스 및 배출지 운영" }
  ],
  en: [
    { label: "Corporate Name", value: "Carbon Energy Solutions Co., Ltd." },
    { label: "Business Registration No.", value: "123-86-09874" },
    { label: "Representative", value: "Hong Gil-dong" },
    { label: "Corporate Registration No.", value: "110111-1234567" },
    { label: "Head Office", value: "110 Sejong-daero, Jung-gu, Seoul" },
    { label: "Business Type", value: "Carbon data services and site operations" }
  ]
} as const;

const SITE_ROWS = {
  ko: [
    { name: "포항 제1 열연공장", code: "PH-001", status: "정상 가동", update: "12분 전" },
    { name: "울산 제3 화학기지", code: "US-042", status: "서류 누락", update: "3시간 전" },
    { name: "광양 제2 에너지센터", code: "GY-112", status: "검증 진행", update: "2일 전" }
  ],
  en: [
    { name: "Pohang Hot Strip Mill 1", code: "PH-001", status: "Operational", update: "12 min ago" },
    { name: "Ulsan Chemical Base 3", code: "US-042", status: "Missing Documents", update: "3 hrs ago" },
    { name: "Gwangyang Energy Center 2", code: "GY-112", status: "Under Verification", update: "2 days ago" }
  ]
} as const;

const CONTACT_ROWS = {
  ko: [
    { name: "이현장", role: "총괄 관리자", access: "법인정보 / 결제 / 사업장", status: "활성" },
    { name: "박검증", role: "검증 담당", access: "보고서 / 증빙 / 검증", status: "활성" },
    { name: "최정산", role: "정산 담당", access: "결제 / 세금계산서", status: "권한 조정 필요" }
  ],
  en: [
    { name: "Lee Hyeon-jang", role: "Master Admin", access: "Corporate / Payment / Sites", status: "Active" },
    { name: "Park Geomjeung", role: "Verification Lead", access: "Reports / Evidence / Review", status: "Active" },
    { name: "Choi Jeongsan", role: "Settlement Lead", access: "Payment / Tax Invoice", status: "Permission Review" }
  ]
} as const;

const DOCUMENT_ROWS = {
  ko: [
    { name: "사업자등록증", updatedAt: "2026.03.25", result: "유효" },
    { name: "법인등기부등본", updatedAt: "2026.03.11", result: "검토 완료" },
    { name: "인감증명서", updatedAt: "2026.02.28", result: "재제출 필요" }
  ],
  en: [
    { name: "Business Registration Certificate", updatedAt: "2026.03.25", result: "Valid" },
    { name: "Corporate Registry Extract", updatedAt: "2026.03.11", result: "Reviewed" },
    { name: "Seal Certificate", updatedAt: "2026.02.28", result: "Resubmission Required" }
  ]
} as const;

const ROADMAP = {
  ko: [
    "4월 10일: 인감증명서 재제출",
    "4월 18일: 울산 제3 화학기지 서류 보완",
    "4월 24일: 분기별 사업장 권한 점검"
  ],
  en: [
    "Apr 10: Resubmit seal certificate",
    "Apr 18: Supplement Ulsan Base 3 documents",
    "Apr 24: Quarterly site permission review"
  ]
} as const;

const MEMO_LINES = {
  ko: [
    "대표자 변경 예정 시 법인등기부등본과 사업자등록증을 함께 갱신해야 합니다.",
    "정산 담당자 권한은 세금계산서 발행 전까지 재확인 권장 상태입니다.",
    "누락 문서가 있는 사업장은 결제 및 보고 연계가 제한될 수 있습니다."
  ],
  en: [
    "If the representative changes, update both the corporate registry and business certificate together.",
    "Settlement permissions should be revalidated before tax invoice issuance.",
    "Sites with missing documents may face payment and reporting restrictions."
  ]
} as const;

const ACTIVITY_LINES = {
  ko: [
    "기업 인감 증명서 업데이트",
    "팀원 박검증 권한 변경",
    "로그인 보안 알림 확인"
  ],
  en: [
    "Updated corporate seal certificate",
    "Changed permissions for Park Geomjeung",
    "Reviewed login security notice"
  ]
} as const;

function badgeTone(status: string) {
  if (/정상|Operational|유효|Valid|활성|Active|검토 완료|Reviewed/.test(status)) {
    return "bg-emerald-50 text-emerald-700 border-emerald-200";
  }
  if (/검증|Verification/.test(status)) {
    return "bg-blue-50 text-blue-700 border-blue-200";
  }
  return "bg-amber-50 text-amber-700 border-amber-200";
}

export function MypageCompanyMigrationPage() {
  const en = isEnglish();
  const copy = COPY[en ? "en" : "ko"];
  const session = useFrontendSession();
  const displayName = useMemo(() => {
    const name = session.value?.userId?.trim();
    return name && name.length > 0 ? name : en ? "Corporate Admin" : "기업 관리자";
  }, [en, session.value?.userId]);

  logGovernanceScope("PAGE", "mypage-company", {});

  return (
    <div
      className="min-h-screen bg-slate-50 text-slate-900"
      style={{
        ["--kr-gov-blue" as string]: "#00378b",
        ["--kr-gov-text-primary" as string]: "#1a1a1a",
        ["--kr-gov-text-secondary" as string]: "#4d4d4d",
        ["--kr-gov-border-light" as string]: "#d9d9d9",
        ["--kr-gov-bg-gray" as string]: "#f2f2f2",
        ["--kr-gov-radius" as string]: "8px"
      }}
    >
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-slate-900 focus:px-3 focus:py-2 focus:text-white">
        {copy.skip}
      </a>
      <UserGovernmentBar governmentText={copy.government} guidelineText={copy.guideline} />
      <UserPortalHeader
        brandTitle={en ? "CCUS Carbon Footprint Platform" : "CCUS 탄소발자국 플랫폼"}
        brandSubtitle={en ? "Corporate Account Center" : "기업 회원 관리 센터"}
        homeHref={buildLocalizedPath("/home", "/en/home")}
        rightContent={(
          <UserLanguageToggle
            en={en}
            onKo={() => navigate("/mypage/company")}
            onEn={() => navigate("/en/mypage/company")}
          />
        )}
      />
      <main id="main-content" className="mx-auto flex w-full max-w-[1440px] flex-col gap-8 px-4 py-8 lg:px-8 lg:py-10">
        <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.08)]" data-help-id="mypage-company-hero">
          <div className="grid gap-0 xl:grid-cols-[1.3fr_0.7fr]">
            <div className="bg-[linear-gradient(135deg,#0f172a_0%,#1d4ed8_52%,#dbeafe_100%)] px-8 py-9 text-white lg:px-10">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-100">{copy.guideline}</p>
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold">{copy.tabCompany}</span>
                <span className="rounded-full border border-white/20 bg-slate-950/20 px-3 py-1 text-xs font-semibold">{copy.companyCardStatus}</span>
              </div>
              <h1 className="mt-5 text-3xl font-semibold tracking-tight lg:text-[2.5rem]">{copy.title}</h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-blue-50/95 lg:text-base">{copy.subtitle}</p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <HomeInput
                  aria-label={copy.searchPlaceholder}
                  placeholder={copy.searchPlaceholder}
                  className="min-w-0 flex-1 border-white/15 bg-white/95 text-slate-900 placeholder:text-slate-500"
                />
                <HomeButton type="button" className="bg-slate-950 text-white hover:bg-slate-800">
                  {copy.searchButton}
                </HomeButton>
              </div>
              <div className="mt-8 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => navigate(buildLocalizedPath("/mypage/profile", "/en/mypage/profile"))}
                  className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/18"
                >
                  {copy.tabProfile}
                </button>
                <button
                  type="button"
                  className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm"
                >
                  {copy.tabCompany}
                </button>
              </div>
            </div>
            <div className="grid gap-4 bg-slate-950 px-6 py-6 text-white lg:px-8">
              <div className="rounded-[24px] border border-white/10 bg-white/5 p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-200">{copy.companyCardRole}</p>
                <h2 className="mt-3 text-2xl font-semibold">{copy.companyCardTitle}</h2>
                <p className="mt-2 text-sm text-slate-300">{displayName}</p>
                <div className="mt-6 grid gap-3 text-sm text-slate-200">
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">{copy.companyCardSites}</div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">{copy.companyCardStatus}</div>
                </div>
              </div>
              <div className="rounded-[24px] border border-white/10 bg-white/5 p-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">{copy.activityTitle}</h3>
                  <span className="text-xs text-blue-200">{copy.activityViewAll}</span>
                </div>
                <div className="mt-4 space-y-3">
                  {ACTIVITY_LINES[en ? "en" : "ko"].map((line, index) => (
                    <div key={line} className="rounded-2xl border border-white/10 bg-slate-900/40 px-4 py-3">
                      <p className="text-sm font-medium">{line}</p>
                      <p className="mt-1 text-xs text-slate-400">2026.04.0{index + 1} 14:2{index}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-8 xl:grid-cols-[1.45fr_0.85fr]">
          <div className="space-y-8">
            <article className="rounded-[28px] border border-slate-200 bg-white p-8 shadow-sm" data-help-id="mypage-company-profile">
              <div className="flex flex-col gap-3 border-b border-slate-100 pb-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-slate-950">{copy.basicInfoTitle}</h2>
                  <p className="mt-1 text-sm text-slate-500">{copy.basicInfoDescription}</p>
                </div>
                <HomeButton type="button" className="bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50">
                  {copy.editRequest}
                </HomeButton>
              </div>
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                {COMPANY_FIELDS[en ? "en" : "ko"].map((field) => (
                  <div key={field.label} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{field.label}</p>
                    <p className="mt-2 text-base font-semibold text-slate-900">{field.value}</p>
                  </div>
                ))}
              </div>
            </article>

            <article className="rounded-[28px] border border-slate-200 bg-white p-8 shadow-sm" data-help-id="mypage-company-sites">
              <h2 className="text-xl font-semibold text-slate-950">{copy.siteSummaryTitle}</h2>
              <div className="mt-5 overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-left">
                  <thead>
                    <tr className="text-xs uppercase tracking-[0.16em] text-slate-500">
                      <th className="px-3 py-3">{en ? "Site" : "사업장"}</th>
                      <th className="px-3 py-3">{en ? "Code" : "코드"}</th>
                      <th className="px-3 py-3">{en ? "Status" : "상태"}</th>
                      <th className="px-3 py-3">{en ? "Updated" : "최근 갱신"}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {SITE_ROWS[en ? "en" : "ko"].map((row) => (
                      <tr key={row.code} className="text-sm">
                        <td className="px-3 py-4 font-semibold text-slate-900">{row.name}</td>
                        <td className="px-3 py-4 text-slate-500">{row.code}</td>
                        <td className="px-3 py-4">
                          <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${badgeTone(row.status)}`}>{row.status}</span>
                        </td>
                        <td className="px-3 py-4 text-slate-500">{row.update}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>

            <div className="grid gap-8 lg:grid-cols-2">
              <article className="rounded-[28px] border border-slate-200 bg-white p-8 shadow-sm" data-help-id="mypage-company-contacts">
                <h2 className="text-xl font-semibold text-slate-950">{copy.contactTitle}</h2>
                <div className="mt-5 space-y-4">
                  {CONTACT_ROWS[en ? "en" : "ko"].map((row) => (
                    <div key={row.name} className="rounded-2xl border border-slate-200 px-4 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-base font-semibold text-slate-900">{row.name}</p>
                          <p className="mt-1 text-sm text-slate-500">{row.role}</p>
                          <p className="mt-3 text-sm text-slate-600">{row.access}</p>
                        </div>
                        <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${badgeTone(row.status)}`}>{row.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </article>

              <article className="rounded-[28px] border border-slate-200 bg-white p-8 shadow-sm">
                <h2 className="text-xl font-semibold text-slate-950">{copy.documentsTitle}</h2>
                <div className="mt-5 space-y-4">
                  {DOCUMENT_ROWS[en ? "en" : "ko"].map((row) => (
                    <div key={row.name} className="rounded-2xl border border-slate-200 px-4 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-base font-semibold text-slate-900">{row.name}</p>
                          <p className="mt-1 text-sm text-slate-500">{row.updatedAt}</p>
                        </div>
                        <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${badgeTone(row.result)}`}>{row.result}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            </div>
          </div>

          <aside className="space-y-8">
            <article className="rounded-[28px] border border-slate-200 bg-white p-8 shadow-sm">
              <h2 className="text-xl font-semibold text-slate-950">{copy.roadmapTitle}</h2>
              <div className="mt-5 space-y-3">
                {ROADMAP[en ? "en" : "ko"].map((item) => (
                  <div key={item} className="rounded-2xl bg-blue-50 px-4 py-4 text-sm font-medium text-blue-900">
                    {item}
                  </div>
                ))}
              </div>
            </article>
            <article className="rounded-[28px] border border-slate-200 bg-white p-8 shadow-sm">
              <h2 className="text-xl font-semibold text-slate-950">{copy.complianceTitle}</h2>
              <div className="mt-5 space-y-3">
                {MEMO_LINES[en ? "en" : "ko"].map((item) => (
                  <div key={item} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-700">
                    {item}
                  </div>
                ))}
              </div>
            </article>
          </aside>
        </section>
      </main>
      <UserPortalFooter
        orgName={copy.footerOrg}
        addressLine={copy.footerAddress}
        footerLinks={copy.footerLinks}
        copyright={copy.footerCopyright}
        lastModifiedLabel={copy.footerLastModifiedLabel}
        waAlt={copy.footerWaAlt}
        serviceLine={copy.footerServiceLine}
      />
    </div>
  );
}

export default MypageCompanyMigrationPage;
