import {
  UserGovernmentBar,
  UserLanguageToggle,
  UserPortalFooter,
  UserPortalHeader
} from "../../components/user-shell/UserPortalChrome";
import { buildLocalizedPath, isEnglish, navigate } from "../../lib/navigation/runtime";

const COURSE_PROGRESS = [
  {
    id: "course-1",
    title: "온실가스 감축 전문 과정",
    titleEn: "Greenhouse Gas Reduction Specialist Program",
    percent: 100
  },
  {
    id: "course-2",
    title: "CCUS 기술 안전 감독",
    titleEn: "CCUS Technical Safety Supervision",
    percent: 85
  },
  {
    id: "course-3",
    title: "현장 윤리 및 보안 수칙",
    titleEn: "Field Ethics and Security Protocols",
    percent: 40
  }
];

const HISTORY_ROWS = [
  {
    id: "history-1",
    title: "2024년 정기 환경안전 관리 교육",
    titleEn: "2024 Environmental Safety Management Training",
    type: "온라인 과정 (16시간)",
    typeEn: "Online course (16h)",
    completedAt: "2024.12.10",
    code: "CERT-2024-1102",
    status: "유효",
    statusEn: "Valid"
  },
  {
    id: "history-2",
    title: "현장 감독관 기본 역량 강화",
    titleEn: "Field Supervisor Core Capability Program",
    type: "집합 과정 (8시간)",
    typeEn: "In-person course (8h)",
    completedAt: "2024.08.22",
    code: "CERT-2024-0822",
    status: "유효",
    statusEn: "Valid"
  },
  {
    id: "history-3",
    title: "배출량 데이터 품질 검증 실습",
    titleEn: "Emission Data Quality Validation Lab",
    type: "혼합 과정 (12시간)",
    typeEn: "Blended course (12h)",
    completedAt: "2024.04.05",
    code: "CERT-2024-0405",
    status: "보관",
    statusEn: "Archived"
  }
];

const ACTION_ITEMS = {
  ko: [
    "수료증 진위 확인",
    "이수 내역 외부 전송"
  ],
  en: [
    "Verify certificate authenticity",
    "Share completion record externally"
  ]
};

export function EduCertificateMigrationPage() {
  const en = isEnglish();

  const copy = {
    skip: en ? "Skip to main content" : "본문 바로가기",
    government: en ? "Official Government Service of the Republic of Korea" : "대한민국 정부 공식 서비스",
    guideline: en ? "Certificate and completion record service" : "교육 이수 증명 및 수료증 서비스",
    brandTitle: en ? "Carbon Neutrality Education Portal" : "탄소중립 교육 포털",
    brandSubtitle: en ? "Certificate Vault" : "수료증 보관함",
    note: en ? "Store, verify, and export officially issued course certificates in one place." : "공식 발급된 교육 수료증을 한 곳에서 보관하고 검증하고 외부로 전송합니다.",
    navClassroom: en ? "My Classroom" : "나의 학습실",
    navCertificate: en ? "Course Certificates" : "교육 이수 증명",
    navNotice: en ? "Notices" : "공지사항",
    userRole: en ? "Field Supervisor" : "현장 감독관",
    userName: en ? "Lee Hyeonjang (ID: ADMIN_2025)" : "이현장 (ID: ADMIN_2025)",
    asideTitle: en ? "2025 Mandatory Learning Status" : "2025년 법정 교육 현황",
    continueLearning: en ? "Resume Learning" : "학습 이어가기",
    verifyTitle: "Verification Center",
    verifyBody: en
      ? "Every certificate issued on this platform is recorded with a unique verification key so authenticity can be checked immediately."
      : "본 플랫폼에서 발급된 모든 수료증은 고유 검증 키와 함께 기록되어 진위 여부를 즉시 확인할 수 있습니다.",
    lockerTitle: en ? "Certificate Vault" : "수료증 보관함",
    lockerBody: en ? "Official proof for courses that were recently completed." : "최근 이수 완료된 교육 과정의 공식 증명서입니다.",
    printAll: en ? "Print All" : "전체 인쇄",
    downloadBundle: en ? "Combined PDF Download" : "PDF 통합 다운로드",
    certTitle: en ? "Certificate of Completion" : "수 료 증",
    nameLabel: en ? "Name" : "성명",
    courseLabel: en ? "Course" : "과정명",
    periodLabel: en ? "Period" : "교육기간",
    learnerName: en ? "Lee Hyeonjang" : "이 현 장",
    courseName: en ? "Practice for Greenhouse Gas Reduction Calculation and Verification" : "온실가스 감축 산정 및 검증 실무",
    coursePeriod: "2025. 07. 01 ~ 2025. 08. 14",
    certBody: en
      ? "This certifies that the above learner faithfully completed the course hosted by the CCUS Integrated Management Headquarters."
      : "위 사람은 CCUS 통합관리본부에서 주관하는 상기 교육 과정을 성실히 이수하였으므로 이 증서를 수여함",
    certDate: en ? "August 14, 2025" : "2025년 08월 14일",
    certSigner: en ? "Director of CCUS Integrated Management Headquarters" : "CCUS 통합관리본부장",
    completionBadge: en ? "Completed (ID: CERT-2025-0814)" : "이수 완료 (ID: CERT-2025-0814)",
    detailTitle: en ? "Greenhouse Gas Reduction Calculation and Verification Program" : "온실가스 감축 산정 및 검증 실무 과정",
    issueInfo: en ? "Issued: 2025.08.14 | Validity: Permanent" : "발급일: 2025.08.14 | 유효기간: 영구",
    issuerLabel: en ? "Issuing authority" : "발급기관",
    issuerValue: en ? "Ministry of Environment Integrated Center" : "환경부 통합관리센터",
    codeLabel: en ? "Verification code" : "검증 코드",
    levelLabel: en ? "Security grade" : "보안 등급",
    levelValue: "Official (Level 2)",
    pdfAction: en ? "Certificate PDF" : "수료증 PDF",
    qrAction: en ? "Mobile Verification QR" : "모바일 확인 QR",
    verifyAction: en ? "Open Verification Site" : "진위 확인 사이트 연결",
    historyTitle: en ? "Previous Completion History" : "이전 이수 내역",
    searchPlaceholder: en ? "Search by course or issue number" : "과정명 또는 발급번호 검색",
    historyCourse: en ? "Course" : "과정명",
    historyDate: en ? "Completion date" : "이수일",
    historyCode: en ? "Issue number" : "발급번호",
    historyStatus: en ? "Status" : "상태",
    historyManage: en ? "Manage" : "관리",
    print: en ? "Print" : "인쇄",
    download: en ? "Download" : "다운로드",
    footerOrg: en ? "CCUS Education Operations Center" : "CCUS 교육운영센터",
    footerAddress: en ? "(04551) 110 Sejong-daero, Jung-gu, Seoul | Education Help Desk: 02-1234-5678" : "(04551) 서울특별시 중구 세종대로 110 | 교육 지원팀 02-1234-5678",
    footerService: en ? "This service supports practical carbon-neutrality capability building for industrial and public teams." : "본 시스템은 공공과 산업 현장의 탄소중립 실무 역량 강화를 지원합니다.",
    footerLinks: en ? Array.from(["Privacy Policy", "Terms of Use", "Sitemap"]) : Array.from(["개인정보처리방침", "이용약관", "사이트맵"]),
    footerWaAlt: en ? "Web Accessibility Quality Mark" : "웹 접근성 품질인증 마크",
    lastModifiedLabel: en ? "Last Modified:" : "최종 수정일:"
  };

  return (
    <div
      className="min-h-screen bg-[linear-gradient(180deg,#f3f6fb_0%,#f8fafc_24%,#ffffff_100%)] text-slate-900"
      style={{
        ["--kr-gov-blue" as string]: "#00378b",
        ["--kr-gov-blue-hover" as string]: "#002d72",
        ["--kr-gov-text-primary" as string]: "#1a1a1a",
        ["--kr-gov-text-secondary" as string]: "#4d4d4d",
        ["--kr-gov-border-light" as string]: "#d9d9d9",
        ["--kr-gov-bg-gray" as string]: "#f8fafc",
        ["--kr-gov-radius" as string]: "10px"
      }}
    >
      <a className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-[var(--kr-gov-blue)] focus:px-4 focus:py-3 focus:text-white" href="#main-content">
        {copy.skip}
      </a>
      <UserGovernmentBar governmentText={copy.government} guidelineText={copy.guideline} />
      <UserPortalHeader
        brandTitle={copy.brandTitle}
        brandSubtitle={copy.brandSubtitle}
        homeHref={buildLocalizedPath("/home", "/en/home")}
        rightContent={(
          <>
            <div className="hidden lg:flex items-center rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600 shadow-sm">
              {copy.note}
            </div>
            <UserLanguageToggle en={en} onKo={() => navigate("/edu/certificate")} onEn={() => navigate("/en/edu/certificate")} />
          </>
        )}
      />

      <main className="mx-auto max-w-[1440px] px-4 py-8 lg:px-8" id="main-content">
        <div className="mb-8 hidden h-14 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm shadow-sm xl:flex">
          <button className="h-full border-b-4 border-transparent px-3 font-bold text-slate-500 transition hover:text-[var(--kr-gov-blue)]" onClick={() => navigate(buildLocalizedPath("/edu/my_course", "/en/edu/my_course"))} type="button">
            {copy.navClassroom}
          </button>
          <button className="h-full border-b-4 border-[var(--kr-gov-blue)] px-3 font-bold text-[var(--kr-gov-blue)]" type="button">
            {copy.navCertificate}
          </button>
          <button className="h-full border-b-4 border-transparent px-3 font-bold text-slate-500 transition hover:text-[var(--kr-gov-blue)]" onClick={() => navigate(buildLocalizedPath("/edu/course_list", "/en/edu/course_list"))} type="button">
            {copy.navNotice}
          </button>
        </div>

        <div className="grid gap-8 lg:grid-cols-[0.34fr_0.66fr]">
          <aside className="space-y-6" data-help-id="edu-certificate-hero">
            <section className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">{copy.userRole}</p>
                  <p className="mt-2 text-lg font-black text-slate-900">{copy.userName}</p>
                </div>
                <button className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-slate-200" type="button">
                  <span className="material-symbols-outlined text-[20px]">notifications</span>
                </button>
              </div>
            </section>

            <section className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="flex items-center gap-2 text-sm font-black text-slate-900">
                <span className="material-symbols-outlined text-[18px] text-blue-600">school</span>
                {copy.asideTitle}
              </h3>
              <div className="mt-6 space-y-5">
                {COURSE_PROGRESS.map((item) => (
                  <div key={item.id}>
                    <div className="mb-2 flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-600">{en ? item.titleEn : item.title}</span>
                      <span className="font-black text-blue-700">{item.percent}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                      <div className="h-full rounded-full bg-[var(--kr-gov-blue)]" style={{ width: `${item.percent}%` }} />
                    </div>
                  </div>
                ))}
              </div>
              <button className="mt-8 w-full rounded-xl bg-blue-50 py-3 text-xs font-black text-blue-700 transition hover:bg-blue-100" type="button">
                {copy.continueLearning}
              </button>
            </section>

            <section className="rounded-[24px] bg-slate-800 p-6 text-white shadow-md">
              <h3 className="text-xs font-bold uppercase tracking-[0.22em] text-slate-400">{copy.verifyTitle}</h3>
              <p className="mt-4 text-sm leading-6 text-slate-300">{copy.verifyBody}</p>
              <div className="mt-6 space-y-2">
                {ACTION_ITEMS[en ? "en" : "ko"].map((item) => (
                  <button className="flex w-full items-center justify-between rounded-xl bg-slate-700/60 p-3 text-left text-xs font-bold transition hover:bg-slate-700" key={item} type="button">
                    <span>{item}</span>
                    <span className="material-symbols-outlined text-[18px]">verified_user</span>
                  </button>
                ))}
              </div>
            </section>
          </aside>

          <section className="space-y-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-3xl font-black text-slate-900">{copy.lockerTitle}</h2>
                <p className="mt-2 text-sm text-slate-500">{copy.lockerBody}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50" type="button">
                  <span className="material-symbols-outlined text-[16px]">print</span>
                  {copy.printAll}
                </button>
                <button className="inline-flex items-center gap-2 rounded-xl bg-[var(--kr-gov-blue)] px-4 py-2 text-xs font-bold text-white transition hover:bg-[var(--kr-gov-blue-hover)]" type="button">
                  <span className="material-symbols-outlined text-[16px]">download</span>
                  {copy.downloadBundle}
                </button>
              </div>
            </div>

            <article className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm" data-help-id="edu-certificate-detail">
              <div className="grid md:grid-cols-[1.5fr_0.9fr]">
                <div className="bg-[#fafafa] p-6 md:p-10">
                  <div className="mx-auto max-w-[520px] border-[12px] border-double border-slate-200 bg-white p-8 shadow-sm">
                    <div className="border border-slate-300 px-6 py-8 text-center">
                      <div className="mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-full border border-slate-300 text-slate-500">
                        <span className="material-symbols-outlined text-[22px]">workspace_premium</span>
                      </div>
                      <h3 className="text-3xl font-black tracking-[0.35em] text-slate-800">{copy.certTitle}</h3>
                      <div className="mt-8 space-y-4 text-left">
                        <div className="flex border-b border-slate-100 pb-2">
                          <span className="w-24 text-[11px] font-bold text-slate-400">{copy.nameLabel}</span>
                          <span className="text-sm font-bold text-slate-800">{copy.learnerName}</span>
                        </div>
                        <div className="flex border-b border-slate-100 pb-2">
                          <span className="w-24 text-[11px] font-bold text-slate-400">{copy.courseLabel}</span>
                          <span className="text-sm font-bold text-slate-800">{copy.courseName}</span>
                        </div>
                        <div className="flex border-b border-slate-100 pb-2">
                          <span className="w-24 text-[11px] font-bold text-slate-400">{copy.periodLabel}</span>
                          <span className="text-sm font-bold text-slate-800">{copy.coursePeriod}</span>
                        </div>
                      </div>
                      <p className="mt-8 text-sm leading-7 text-slate-600">{copy.certBody}</p>
                      <p className="mt-8 text-sm font-bold text-slate-800">{copy.certDate}</p>
                      <div className="mt-8 flex flex-col items-center gap-2">
                        <span className="text-lg font-black text-slate-900">{copy.certSigner}</span>
                        <div className="flex h-16 w-16 items-center justify-center rounded-full border border-amber-400/50 bg-amber-100/70 text-amber-700 shadow-sm">
                          <span className="material-symbols-outlined text-[28px]">approval</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col border-t border-slate-100 p-8 md:border-l md:border-t-0">
                  <div className="mb-auto">
                    <span className="inline-block rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-[10px] font-black text-emerald-700">
                      {copy.completionBadge}
                    </span>
                    <h3 className="mt-4 text-xl font-black leading-tight text-slate-900">{copy.detailTitle}</h3>
                    <p className="mt-2 text-xs text-slate-500">{copy.issueInfo}</p>

                    <div className="mt-6 space-y-3 rounded-2xl bg-slate-50 p-4">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400">{copy.issuerLabel}</span>
                        <span className="font-bold text-slate-700">{copy.issuerValue}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400">{copy.codeLabel}</span>
                        <span className="font-mono font-bold text-blue-700">A82-F91-C24</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400">{copy.levelLabel}</span>
                        <span className="font-bold text-slate-700">{copy.levelValue}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-8 space-y-3">
                    <button className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white py-3 text-xs font-bold text-slate-700 transition hover:bg-slate-50" type="button">
                      <span className="material-symbols-outlined text-[18px]">download</span>
                      {copy.pdfAction}
                    </button>
                    <button className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white py-3 text-xs font-bold text-slate-700 transition hover:bg-slate-50" type="button">
                      <span className="material-symbols-outlined text-[18px]">qr_code</span>
                      {copy.qrAction}
                    </button>
                    <button className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 py-3 text-xs font-bold text-white transition hover:bg-slate-800" type="button">
                      <span className="material-symbols-outlined text-[18px]">verified</span>
                      {copy.verifyAction}
                    </button>
                  </div>
                </div>
              </div>
            </article>

            <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-col gap-4 border-b border-slate-100 p-6 lg:flex-row lg:items-center lg:justify-between">
                <h3 className="flex items-center gap-2 text-sm font-black text-slate-900">
                  <span className="material-symbols-outlined text-[18px] text-slate-400">history</span>
                  {copy.historyTitle}
                </h3>
                <label className="relative block w-full lg:w-72">
                  <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-slate-400">search</span>
                  <input className="w-full rounded-full border border-slate-200 bg-slate-50 py-2 pl-10 pr-4 text-xs outline-none transition focus:border-blue-500 focus:bg-white" placeholder={copy.searchPlaceholder} type="text" />
                </label>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full text-left">
                  <thead>
                    <tr className="bg-slate-50 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                      <th className="px-6 py-4">{copy.historyCourse}</th>
                      <th className="px-6 py-4">{copy.historyDate}</th>
                      <th className="px-6 py-4">{copy.historyCode}</th>
                      <th className="px-6 py-4">{copy.historyStatus}</th>
                      <th className="px-6 py-4 text-right">{copy.historyManage}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {HISTORY_ROWS.map((row) => (
                      <tr className="hover:bg-slate-50/70" key={row.id}>
                        <td className="px-6 py-4">
                          <p className="text-sm font-bold text-slate-800">{en ? row.titleEn : row.title}</p>
                          <p className="mt-1 text-[11px] text-slate-400">{en ? row.typeEn : row.type}</p>
                        </td>
                        <td className="px-6 py-4 text-xs font-bold text-slate-500">{row.completedAt}</td>
                        <td className="px-6 py-4 font-mono text-[11px] text-slate-500">{row.code}</td>
                        <td className="px-6 py-4">
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-bold text-slate-600">{en ? row.statusEn : row.status}</span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-3">
                            <button className="text-[11px] font-bold text-[var(--kr-gov-blue)] hover:underline" type="button">{copy.print}</button>
                            <button className="text-[11px] font-bold text-[var(--kr-gov-blue)] hover:underline" type="button">{copy.download}</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </section>
        </div>
      </main>

      <UserPortalFooter
        addressLine={copy.footerAddress}
        copyright="© 2026 CCUS Carbon Education Portal. All rights reserved."
        footerLinks={copy.footerLinks}
        lastModifiedLabel={copy.lastModifiedLabel}
        orgName={copy.footerOrg}
        serviceLine={copy.footerService}
        waAlt={copy.footerWaAlt}
      />
    </div>
  );
}
