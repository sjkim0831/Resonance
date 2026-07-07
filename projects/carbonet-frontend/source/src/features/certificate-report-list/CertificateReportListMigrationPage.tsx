import { useEffect, useMemo, useState } from "react";
import { useFrontendSession } from "../../app/hooks/useFrontendSession";
import { logGovernanceScope } from "../../app/policy/debug";
import { UserGovernmentBar, UserLanguageToggle, UserPortalFooter } from "../../components/user-shell/UserPortalChrome";
import { buildLocalizedPath, isEnglish, navigate } from "../../lib/navigation/runtime";

type WorkflowCard = {
  stage: "draft" | "review" | "issued";
  category: string;
  badgeClassName: string;
  dueLabel: string;
  title: string;
  description: string;
  actionLabel: string;
  actionHref: string;
  urgent?: boolean;
};

type DocumentRow = {
  id: string;
  type: string;
  company: string;
  site: string;
  stage: string;
  stageKey: "draft" | "review" | "issued";
  priority: "urgent" | "normal";
  dueLabel: string;
  updatedAt: string;
  assignee: string;
  actionLabel: string;
  actionHref: string;
};

const WORKFLOW_CARDS = {
  ko: [
    { stage: "draft", category: "정기 보고서", badgeClassName: "bg-blue-50 text-blue-700", dueLabel: "D-15", title: "2026년 1분기 배출량 보고서", description: "포항 제1 열연공장 활동자료 대조와 임시저장 버전 확인이 필요합니다.", actionLabel: "작성 계속하기", actionHref: "/certificate/report_form" },
    { stage: "draft", category: "인증서 신청", badgeClassName: "bg-purple-50 text-purple-700", dueLabel: "D-2", title: "ISO 14064 사후 심사 준비", description: "갱신 신청 전 시설 정보와 인증 기간 확정이 필요합니다.", actionLabel: "인증서 신청 계속", actionHref: "/certificate/apply", urgent: true },
    { stage: "review", category: "보완 요청", badgeClassName: "bg-orange-50 text-orange-700", dueLabel: "D-10", title: "울산 제3 화학기지 배출 분석서", description: "고정 연소 섹션의 8월분 연료 소비량 증빙 보완 요청이 도착했습니다.", actionLabel: "보완 수정", actionHref: "/certificate/report_edit" },
    { stage: "issued", category: "발급 완료", badgeClassName: "bg-emerald-50 text-emerald-700", dueLabel: "완료", title: "서부 포집 시범단지 감축 성과 인증서", description: "최종 발급본과 운영 메모가 보관되어 있으며 다운로드 가능합니다.", actionLabel: "발급본 보기", actionHref: "/certificate/report_list" }
  ] satisfies WorkflowCard[],
  en: [
    { stage: "draft", category: "Periodic report", badgeClassName: "bg-blue-50 text-blue-700", dueLabel: "D-15", title: "Q1 2026 Emission Report", description: "Pohang hot rolling mill source data still needs reconciliation before submission.", actionLabel: "Continue drafting", actionHref: "/en/certificate/report_form" },
    { stage: "draft", category: "Certificate apply", badgeClassName: "bg-purple-50 text-purple-700", dueLabel: "D-2", title: "ISO 14064 Follow-up Audit", description: "Confirm facility ownership and certification period before submitting the renewal packet.", actionLabel: "Continue certificate apply", actionHref: "/en/certificate/apply", urgent: true },
    { stage: "review", category: "Supplement request", badgeClassName: "bg-orange-50 text-orange-700", dueLabel: "D-10", title: "Ulsan Site 3 Emission Analysis", description: "Supporting evidence for August fuel consumption must be supplemented.", actionLabel: "Open revision task", actionHref: "/en/certificate/report_edit" },
    { stage: "issued", category: "Issued", badgeClassName: "bg-emerald-50 text-emerald-700", dueLabel: "Done", title: "West Coast Capture Pilot Certificate", description: "Issued copy and operation notes are archived and ready for download.", actionLabel: "Open issued file", actionHref: "/en/certificate/report_list" }
  ] satisfies WorkflowCard[]
};

const DOCUMENT_ROWS = {
  ko: [
    { id: "DOC-2026-001", type: "정기 보고서", company: "포항 제1 열연공장", site: "제강 라인 A", stage: "작성 중", stageKey: "draft", priority: "normal", dueLabel: "D-15", updatedAt: "2026-04-02 09:20", assignee: "이현장", actionLabel: "작성", actionHref: "/certificate/report_form" },
    { id: "DOC-2026-002", type: "인증서 갱신", company: "울산 제3 화학기지", site: "화학 공정군", stage: "내부 검토", stageKey: "review", priority: "urgent", dueLabel: "D-2", updatedAt: "2026-04-02 08:40", assignee: "정심사", actionLabel: "수정", actionHref: "/certificate/report_edit" },
    { id: "DOC-2026-003", type: "분기 배출 보고서", company: "광양 제2 제철소", site: "압연 설비", stage: "내부 검토", stageKey: "review", priority: "normal", dueLabel: "D-7", updatedAt: "2026-04-01 17:12", assignee: "문운영", actionLabel: "보완", actionHref: "/certificate/report_edit" },
    { id: "DOC-2026-004", type: "성과 인증서", company: "서부 포집 시범단지", site: "포집 모듈 B", stage: "발급 완료", stageKey: "issued", priority: "normal", dueLabel: "보관", updatedAt: "2026-03-29 14:05", assignee: "시스템 발급", actionLabel: "열람", actionHref: "/certificate/report_list" },
    { id: "DOC-2026-005", type: "REC 확인서", company: "남부 CO2 회수센터", site: "회수 라인 1", stage: "작성 중", stageKey: "draft", priority: "urgent", dueLabel: "D-1", updatedAt: "2026-04-02 07:55", assignee: "김담당", actionLabel: "계속", actionHref: "/admin/certificate/rec_check" },
    { id: "DOC-2026-006", type: "준수 확인서", company: "수도권 준수 점검단", site: "감사 데스크", stage: "발급 완료", stageKey: "issued", priority: "normal", dueLabel: "발급", updatedAt: "2026-03-28 10:18", assignee: "감사운영", actionLabel: "다운로드", actionHref: "/certificate/report_list" }
  ] satisfies DocumentRow[],
  en: [
    { id: "DOC-2026-001", type: "Periodic report", company: "Pohang Hot Rolling Mill 1", site: "Steel line A", stage: "Drafting", stageKey: "draft", priority: "normal", dueLabel: "D-15", updatedAt: "2026-04-02 09:20", assignee: "Lee Field", actionLabel: "Edit", actionHref: "/en/certificate/report_form" },
    { id: "DOC-2026-002", type: "Certificate renewal", company: "Ulsan Chemical Base 3", site: "Chemical cluster", stage: "In review", stageKey: "review", priority: "urgent", dueLabel: "D-2", updatedAt: "2026-04-02 08:40", assignee: "Jung Audit", actionLabel: "Revise", actionHref: "/en/certificate/report_edit" },
    { id: "DOC-2026-003", type: "Quarterly report", company: "Gwangyang Steel Site 2", site: "Rolling unit", stage: "In review", stageKey: "review", priority: "normal", dueLabel: "D-7", updatedAt: "2026-04-01 17:12", assignee: "Moon Ops", actionLabel: "Revise", actionHref: "/en/certificate/report_edit" },
    { id: "DOC-2026-004", type: "Performance certificate", company: "West Coast Capture Pilot", site: "Capture module B", stage: "Issued", stageKey: "issued", priority: "normal", dueLabel: "Archive", updatedAt: "2026-03-29 14:05", assignee: "System issue", actionLabel: "Open", actionHref: "/en/certificate/report_list" },
    { id: "DOC-2026-005", type: "REC verification", company: "Southern CO2 Recovery Center", site: "Recovery line 1", stage: "Drafting", stageKey: "draft", priority: "urgent", dueLabel: "D-1", updatedAt: "2026-04-02 07:55", assignee: "Kim Owner", actionLabel: "Continue", actionHref: "/en/admin/certificate/rec_check" },
    { id: "DOC-2026-006", type: "Compliance certificate", company: "Capital Compliance Group", site: "Audit desk", stage: "Issued", stageKey: "issued", priority: "normal", dueLabel: "Issued", updatedAt: "2026-03-28 10:18", assignee: "Audit ops", actionLabel: "Download", actionHref: "/en/certificate/report_list" }
  ] satisfies DocumentRow[]
};

function InlineStyles() {
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
      body { font-family: 'Noto Sans KR', 'Public Sans', sans-serif; -webkit-font-smoothing: antialiased; }
      .skip-link { position: absolute; top: -100px; left: 0; background: var(--kr-gov-blue); color: white; padding: 12px; z-index: 100; transition: top .2s ease; }
      .skip-link:focus { top: 0; }
      .gov-btn { padding: 0.625rem 1.25rem; font-weight: 700; border-radius: var(--kr-gov-radius); transition: background-color .2s ease, color .2s ease, border-color .2s ease; }
      .gov-card { border: 1px solid var(--kr-gov-border-light); border-radius: 16px; background: white; box-shadow: 0 14px 34px rgba(15, 23, 42, 0.05); }
      .kanban-column { background: linear-gradient(180deg, #eef4fb 0%, #f8fbff 100%); border: 1px solid #d7e3f5; border-radius: 20px; padding: 1rem; }
      .kanban-card { background: white; border: 1px solid #e5e7eb; border-radius: 16px; padding: 1rem; box-shadow: 0 8px 24px rgba(15, 23, 42, 0.05); }
    `}</style>
  );
}

function stageTone(stage: DocumentRow["stageKey"]) {
  if (stage === "draft") return "bg-blue-50 text-blue-700";
  if (stage === "review") return "bg-orange-50 text-orange-700";
  return "bg-emerald-50 text-emerald-700";
}

export function CertificateReportListMigrationPage() {
  const en = isEnglish();
  const session = useFrontendSession();
  const [searchKeyword, setSearchKeyword] = useState("");
  const [stageFilter, setStageFilter] = useState<"ALL" | DocumentRow["stageKey"]>("ALL");
  const [priorityFilter, setPriorityFilter] = useState<"ALL" | DocumentRow["priority"]>("ALL");

  const workflowCards = WORKFLOW_CARDS[en ? "en" : "ko"];
  const rows = DOCUMENT_ROWS[en ? "en" : "ko"];
  const filteredRows = useMemo(
    () => rows.filter((row) => {
      const matchesKeyword = !searchKeyword || [row.id, row.type, row.company, row.site, row.assignee].some((field) => field.toLowerCase().includes(searchKeyword.toLowerCase()));
      const matchesStage = stageFilter === "ALL" || row.stageKey === stageFilter;
      const matchesPriority = priorityFilter === "ALL" || row.priority === priorityFilter;
      return matchesKeyword && matchesStage && matchesPriority;
    }),
    [priorityFilter, rows, searchKeyword, stageFilter]
  );

  const draftingCount = rows.filter((row) => row.stageKey === "draft").length;
  const reviewCount = rows.filter((row) => row.stageKey === "review").length;
  const issuedCount = rows.filter((row) => row.stageKey === "issued").length;
  const urgentCount = rows.filter((row) => row.priority === "urgent").length;

  useEffect(() => {
    logGovernanceScope("PAGE", "certificate-report-list", {
      language: en ? "en" : "ko",
      totalCount: rows.length,
      filteredCount: filteredRows.length,
      stageFilter,
      priorityFilter
    });
  }, [en, filteredRows.length, priorityFilter, rows.length, stageFilter]);

  return (
    <>
      <InlineStyles />
      <div className="min-h-screen bg-[#f4f7fa] text-[var(--kr-gov-text-primary)]">
        <a className="skip-link" href="#main-content">{en ? "Skip to content" : "본문 바로가기"}</a>
        <UserGovernmentBar
          governmentText={en ? "Official Government Service of the Republic of Korea" : "대한민국 정부 공식 서비스"}
          guidelineText={en ? "Field supervisor portal for report and certificate operations." : "대한민국 정부 공식 서비스 | 현장 감독관 전용 포털"}
        />
        <header className="sticky top-0 z-40 border-b border-[var(--kr-gov-border-light)] bg-white/95 backdrop-blur">
          <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 lg:px-8 xl:flex-row xl:items-center xl:justify-between">
            <button className="flex items-center gap-3 bg-transparent p-0 text-left" type="button" onClick={() => navigate(buildLocalizedPath("/home", "/en/home"))}>
              <span className="material-symbols-outlined text-[34px] text-[var(--kr-gov-blue)]">task_alt</span>
              <div>
                <h1 className="text-xl font-black leading-tight">{en ? "Report & Certificate Management" : "보고서 & 인증서 관리"}</h1>
                <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[var(--kr-gov-text-secondary)]">Document Lifecycle Manager</p>
              </div>
            </button>
            <nav className="flex flex-wrap gap-2 text-sm font-bold text-[var(--kr-gov-text-secondary)]">
              <a className="rounded-full border border-slate-200 px-4 py-2 hover:border-[var(--kr-gov-blue)] hover:text-[var(--kr-gov-blue)]" href={buildLocalizedPath("/monitoring/track", "/en/monitoring/track")}>{en ? "Monitoring" : "배출지 모니터링"}</a>
              <a className="rounded-full border border-slate-200 px-4 py-2 hover:border-[var(--kr-gov-blue)] hover:text-[var(--kr-gov-blue)]" href={buildLocalizedPath("/emission/data_input", "/en/emission/data_input")}>{en ? "Data Input" : "데이터 산정"}</a>
              <a className="rounded-full border border-[var(--kr-gov-blue)] bg-[var(--kr-gov-blue)] px-4 py-2 text-white" href={buildLocalizedPath("/certificate/report_list", "/en/certificate/report_list")}>{en ? "Reports & Certificates" : "보고서 & 인증서 목록"}</a>
              <a className="rounded-full border border-slate-200 px-4 py-2 hover:border-[var(--kr-gov-blue)] hover:text-[var(--kr-gov-blue)]" href={buildLocalizedPath("/co2/analysis", "/en/co2/analysis")}>{en ? "Analytics" : "성과 분석"}</a>
            </nav>
            <div className="flex items-center gap-3">
              <UserLanguageToggle en={en} onKo={() => navigate("/certificate/report_list")} onEn={() => navigate("/en/certificate/report_list")} />
              {session.value?.authenticated ? (
                <button className="gov-btn bg-[var(--kr-gov-blue)] text-white hover:bg-[var(--kr-gov-blue-hover)]" type="button" onClick={() => void session.logout()}>{en ? "Logout" : "로그아웃"}</button>
              ) : (
                <a className="gov-btn border border-[var(--kr-gov-blue)] text-[var(--kr-gov-blue)] hover:bg-blue-50" href={buildLocalizedPath("/signin/loginView", "/en/signin/loginView")}>{en ? "Login" : "로그인"}</a>
              )}
            </div>
          </div>
        </header>

        <main id="main-content">
          <section className="bg-slate-950 text-white" data-help-id="certificate-report-list-hero">
            <div className="mx-auto max-w-7xl px-4 py-14 lg:px-8">
              <div className="grid gap-8 xl:grid-cols-[1.4fr,0.9fr] xl:items-center">
                <div>
                  <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-indigo-400/30 bg-indigo-500/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.24em] text-indigo-300">
                    <span className="material-symbols-outlined text-base">auto_awesome</span>
                    {en ? "Workflow AI Assistant" : "지능형 문서 관리 비서"}
                  </div>
                  <h2 className="text-4xl font-black leading-tight">
                    {en ? "Track report deadlines, review queues, and certificate renewals in one board." : "보고서 제출, 검토 큐, 인증서 갱신 일정을 하나의 보드에서 관리합니다."}
                  </h2>
                  <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300">
                    {en ? "This screen consolidates drafting, internal review, and issued-document follow-up so operators can keep urgent work moving without switching between menus." : "작성 중, 내부 검토, 발급 완료 흐름을 한 화면으로 모아 급행 작업과 만기 임박 문서를 끊김 없이 추적합니다."}
                  </p>
                  <div className="mt-8 flex flex-wrap gap-3">
                    <a className="gov-btn bg-indigo-600 text-white hover:bg-indigo-500" href={buildLocalizedPath("/certificate/report_form", "/en/certificate/report_form")}>{en ? "Create report" : "신규 보고서 생성"}</a>
                    <a className="gov-btn border border-white/20 bg-white/10 text-white hover:bg-white/15" href={buildLocalizedPath("/certificate/apply", "/en/certificate/apply")}>{en ? "Apply certificate" : "인증서 신청"}</a>
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2" data-help-id="certificate-report-list-summary">
                  {[
                    { label: en ? "Drafting" : "작성 중", value: draftingCount, tone: "text-blue-300" },
                    { label: en ? "In Review" : "내부 검토", value: reviewCount, tone: "text-orange-300" },
                    { label: en ? "Issued" : "발급 완료", value: issuedCount, tone: "text-emerald-300" },
                    { label: en ? "Urgent" : "긴급", value: urgentCount, tone: "text-rose-300" }
                  ].map((item) => (
                    <article className="rounded-3xl border border-white/10 bg-white/5 p-5" key={item.label}>
                      <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">{item.label}</p>
                      <p className={`mt-3 text-4xl font-black ${item.tone}`}>{item.value}</p>
                    </article>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="mx-auto max-w-7xl px-4 py-10 lg:px-8" data-help-id="certificate-report-list-workflow">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-black">{en ? "Workflow Status" : "지능형 워크플로우 현황"}</h3>
                <p className="mt-2 text-sm text-[var(--kr-gov-text-secondary)]">{en ? "The board groups report and certificate tasks by current stage." : "보고서와 인증서 과업을 현재 단계별로 모아 보여줍니다."}</p>
              </div>
              <div className="hidden gap-2 sm:flex">
                <span className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-bold text-red-600">{en ? `${urgentCount} urgent` : `긴급 ${urgentCount}`}</span>
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-bold text-slate-700">{en ? `${rows.length - urgentCount} normal` : `정상 ${rows.length - urgentCount}`}</span>
              </div>
            </div>
            <div className="grid gap-5 xl:grid-cols-3">
              {[
                { key: "draft", title: en ? "Drafting" : "작성 중" },
                { key: "review", title: en ? "Internal Review" : "내부 검토" },
                { key: "issued", title: en ? "Issued" : "발급 완료" }
              ].map((column) => (
                <section className="kanban-column" key={column.key}>
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-black text-slate-700">{column.title}</h4>
                    <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-slate-500">{workflowCards.filter((card) => card.stage === column.key).length}</span>
                  </div>
                  <div className="space-y-4">
                    {workflowCards.filter((card) => card.stage === column.key).map((card) => (
                      <article className="kanban-card" key={card.title}>
                        <div className="flex items-start justify-between gap-3">
                          <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${card.badgeClassName}`}>{card.category}</span>
                          <span className={`text-xs font-black ${card.urgent ? "text-red-500" : "text-slate-400"}`}>{card.dueLabel}</span>
                        </div>
                        <h5 className="mt-4 text-base font-black text-slate-900">{card.title}</h5>
                        <p className="mt-2 text-sm leading-6 text-slate-500">{card.description}</p>
                        <a className="mt-5 inline-flex items-center gap-1 text-sm font-black text-[var(--kr-gov-blue)]" href={card.actionHref}>
                          {card.actionLabel}
                          <span className="material-symbols-outlined text-base">chevron_right</span>
                        </a>
                      </article>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </section>

          <section className="mx-auto max-w-7xl px-4 pb-16 lg:px-8">
            <div className="gov-card overflow-hidden" data-help-id="certificate-report-list-filters">
              <div className="border-b border-[var(--kr-gov-border-light)] px-6 py-5">
                <h3 className="text-lg font-black">{en ? "Search and Focus" : "검색 및 집중 보기"}</h3>
                <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">{en ? "Filter the portfolio by keyword, stage, and priority before opening the next task." : "검색어, 단계, 긴급도로 문서 포트폴리오를 좁힌 뒤 다음 작업으로 이동합니다."}</p>
              </div>
              <div className="grid gap-4 px-6 py-6 lg:grid-cols-[minmax(0,1.5fr),220px,220px,auto]">
                <label>
                  <span className="mb-2 block text-sm font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Keyword" : "검색어"}</span>
                  <input className="w-full rounded-xl border border-[var(--kr-gov-border-light)] px-4 py-3 text-sm outline-none focus:border-[var(--kr-gov-blue)]" placeholder={en ? "Document ID, company, site, assignee" : "문서번호, 회사명, 배출지, 담당자"} value={searchKeyword} onChange={(event) => setSearchKeyword(event.target.value)} />
                </label>
                <label>
                  <span className="mb-2 block text-sm font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Stage" : "단계"}</span>
                  <select className="w-full rounded-xl border border-[var(--kr-gov-border-light)] px-4 py-3 text-sm outline-none focus:border-[var(--kr-gov-blue)]" value={stageFilter} onChange={(event) => setStageFilter(event.target.value as "ALL" | DocumentRow["stageKey"])}>
                    <option value="ALL">{en ? "All" : "전체"}</option>
                    <option value="draft">{en ? "Drafting" : "작성 중"}</option>
                    <option value="review">{en ? "In Review" : "내부 검토"}</option>
                    <option value="issued">{en ? "Issued" : "발급 완료"}</option>
                  </select>
                </label>
                <label>
                  <span className="mb-2 block text-sm font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Priority" : "긴급도"}</span>
                  <select className="w-full rounded-xl border border-[var(--kr-gov-border-light)] px-4 py-3 text-sm outline-none focus:border-[var(--kr-gov-blue)]" value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value as "ALL" | DocumentRow["priority"])}>
                    <option value="ALL">{en ? "All" : "전체"}</option>
                    <option value="urgent">{en ? "Urgent" : "긴급"}</option>
                    <option value="normal">{en ? "Normal" : "정상"}</option>
                  </select>
                </label>
                <div className="flex items-end gap-2">
                  <button className="gov-btn border border-slate-200 text-slate-700 hover:bg-slate-50" type="button" onClick={() => {
                    setSearchKeyword("");
                    setStageFilter("ALL");
                    setPriorityFilter("ALL");
                  }}>{en ? "Reset" : "초기화"}</button>
                </div>
              </div>
            </div>

            <section className="gov-card mt-6 overflow-hidden" data-help-id="certificate-report-list-table">
              <div className="border-b border-[var(--kr-gov-border-light)] bg-slate-50 px-6 py-5">
                <h3 className="text-lg font-black">{en ? "Document Portfolio" : "문서 포트폴리오 목록"}</h3>
                <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">{en ? `Showing ${filteredRows.length} items out of ${rows.length}.` : `총 ${rows.length}건 중 ${filteredRows.length}건을 표시합니다.`}</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1080px] text-sm">
                  <thead className="border-b border-[var(--kr-gov-border-light)] bg-white text-left text-[var(--kr-gov-text-secondary)]">
                    <tr>
                      <th className="px-5 py-4 font-bold">{en ? "Document" : "문서"}</th>
                      <th className="px-5 py-4 font-bold">{en ? "Company / Site" : "회사 / 배출지"}</th>
                      <th className="px-5 py-4 font-bold">{en ? "Stage" : "단계"}</th>
                      <th className="px-5 py-4 font-bold">{en ? "Priority" : "긴급도"}</th>
                      <th className="px-5 py-4 font-bold">{en ? "Due" : "기한"}</th>
                      <th className="px-5 py-4 font-bold">{en ? "Updated" : "최근 업데이트"}</th>
                      <th className="px-5 py-4 font-bold">{en ? "Assignee" : "담당자"}</th>
                      <th className="px-5 py-4 font-bold">{en ? "Action" : "바로가기"}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {filteredRows.length === 0 ? (
                      <tr>
                        <td className="px-5 py-12 text-center text-sm text-[var(--kr-gov-text-secondary)]" colSpan={8}>{en ? "No documents match the current filters." : "현재 조건에 맞는 문서가 없습니다."}</td>
                      </tr>
                    ) : filteredRows.map((row) => (
                      <tr key={row.id}>
                        <td className="px-5 py-4"><div className="font-black text-slate-900">{row.id}</div><div className="mt-1 text-xs text-slate-500">{row.type}</div></td>
                        <td className="px-5 py-4"><div className="font-bold text-slate-800">{row.company}</div><div className="mt-1 text-xs text-slate-500">{row.site}</div></td>
                        <td className="px-5 py-4"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${stageTone(row.stageKey)}`}>{row.stage}</span></td>
                        <td className="px-5 py-4"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${row.priority === "urgent" ? "bg-red-50 text-red-600" : "bg-slate-100 text-slate-700"}`}>{row.priority === "urgent" ? (en ? "Urgent" : "긴급") : (en ? "Normal" : "정상")}</span></td>
                        <td className="px-5 py-4 font-bold text-slate-700">{row.dueLabel}</td>
                        <td className="px-5 py-4 text-slate-500">{row.updatedAt}</td>
                        <td className="px-5 py-4 text-slate-700">{row.assignee}</td>
                        <td className="px-5 py-4"><a className="inline-flex items-center gap-1 font-black text-[var(--kr-gov-blue)]" href={row.actionHref}>{row.actionLabel}<span className="material-symbols-outlined text-base">open_in_new</span></a></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </section>
        </main>

        <UserPortalFooter
          orgName={en ? "CCUS Integrated Management Office" : "CCUS 통합관리본부"}
          addressLine={en ? "(04551) 110 Sejong-daero, Jung-gu, Seoul, Korea" : "(04551) 서울특별시 중구 세종대로 110"}
          serviceLine={en ? "This service manages greenhouse gas reduction performance in accordance with relevant laws." : "본 서비스는 관계 법령에 의거하여 온실가스 감축 성과를 관리합니다."}
          footerLinks={en ? ["Privacy Policy", "Terms of Use", "Sitemap", "Email Collection Refusal"] : ["개인정보처리방침", "이용약관", "사이트맵", "이메일무단수집거부"]}
          copyright="© 2026 CCUS Carbon Footprint Platform. All rights reserved."
          lastModifiedLabel={en ? "Last Modified:" : "최종 수정일:"}
          waAlt={en ? "Web Accessibility Quality Mark" : "웹 접근성 품질인증 마크"}
        />
      </div>
    </>
  );
}
