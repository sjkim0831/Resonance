import { useEffect, useState } from "react";
import { logGovernanceScope } from "../../app/policy/debug";
import {
  UserGovernmentBar,
  UserLanguageToggle,
  UserPortalFooter,
  UserPortalHeader
} from "../../components/user-shell/UserPortalChrome";
import { isEnglish, navigate } from "../../lib/navigation/runtime";
import { HomeButton } from "../home-ui/common";

type CopySet = {
  skip: string;
  government: string;
  guideline: string;
  homePath: string;
  brandTitle: string;
  brandSubtitle: string;
  displayRole: string;
  displayName: string;
  logout: string;
  heroTitle: string;
  heroBody: string;
  draftPlaceholder: string;
  attachFile: string;
  uploadCapture: string;
  startInquiry: string;
  quickKeywords: string;
  keywordItems: string[];
  historyTitle: string;
  historyBody: string;
  historySearch: string;
  filter: string;
  allStatus: string;
  activeAgent: string;
  onlineReady: string;
  typeMessage: string;
  moreActions: string;
  callAgent: string;
  addAttachment: string;
  emoji: string;
  viewMoreHistory: string;
  noResultTitle: string;
  noResultBody: string;
  metrics: Array<{ label: string; value: string; tone: string }>;
  footerOrg: string;
  footerAddress: string;
  footerCopyright: string;
  footerLastModifiedLabel: string;
  footerWaAlt: string;
};

type Message = {
  id: string;
  author: "user" | "agent";
  body: string;
  time: string;
  readLabel?: string;
};

type Thread = {
  id: string;
  status: "waiting" | "answered" | "closed";
  title: string;
  preview: string;
  date: string;
  agentName: string;
  agentStatus: string;
  dateLabel: string;
  messages: Message[];
};

const COPY: Record<"ko" | "en", CopySet> = {
  ko: {
    skip: "본문 바로가기",
    government: "대한민국 정부 공식 서비스",
    guideline: "이 누리집은 2025 디지털 정부 UI/UX 가이드라인을 준수합니다.",
    homePath: "/home",
    brandTitle: "고객지원",
    brandSubtitle: "Inquiry History Workspace",
    displayRole: "현장 감독관",
    displayName: "이현장 관리자님",
    logout: "로그아웃",
    heroTitle: "무엇을 도와드릴까요?",
    heroBody: "문의 내용을 자연스럽게 입력하면 전담 상담원이 확인하고 같은 화면에서 계속 대화를 이어갈 수 있습니다.",
    draftPlaceholder: "예: 울산 제3 화학기지 증빙서류 업로드 후에도 누락 상태가 계속 표시됩니다.",
    attachFile: "파일 첨부",
    uploadCapture: "캡처 업로드",
    startInquiry: "문의 시작하기",
    quickKeywords: "빠른 키워드",
    keywordItems: ["배출량 입력 오류", "로그인/계정", "증빙 서류 기준", "배출지 등록 문의"],
    historyTitle: "나의 문의 내역",
    historyBody: "이전 문의를 다시 열어 진행 상황을 확인하고 추가 자료를 이어서 전달할 수 있습니다.",
    historySearch: "문의 내용 검색...",
    filter: "필터",
    allStatus: "전체 상태",
    activeAgent: "전담 상담원",
    onlineReady: "현재 응답 가능",
    typeMessage: "메시지를 입력하세요...",
    moreActions: "추가 작업",
    callAgent: "상담원 연결",
    addAttachment: "첨부 추가",
    emoji: "이모지",
    viewMoreHistory: "더 많은 과거 기록 보기",
    noResultTitle: "검색 결과가 없습니다.",
    noResultBody: "검색어를 비우거나 상태 필터를 변경해 보세요.",
    metrics: [
      { label: "진행 중 문의", value: "03", tone: "amber" },
      { label: "오늘 신규 등록", value: "02", tone: "indigo" },
      { label: "최근 종결", value: "11", tone: "emerald" }
    ],
    footerOrg: "CCUS 통합관리본부",
    footerAddress: "(04551) 서울특별시 중구 세종대로 110 | 고객지원센터: 02-1234-5678 (평일 09:00~18:00)",
    footerCopyright: "© 2025 CCUS Carbon Footprint Platform. All rights reserved.",
    footerLastModifiedLabel: "최종 수정일:",
    footerWaAlt: "웹 접근성 품질인증 마크"
  },
  en: {
    skip: "Skip to main content",
    government: "Official Website of the Republic of Korea",
    guideline: "This website complies with the 2025 Digital Government UI/UX Guidelines.",
    homePath: "/en/home",
    brandTitle: "Support Center",
    brandSubtitle: "Inquiry History Workspace",
    displayRole: "Field Supervisor",
    displayName: "Hyun-jang Lee",
    logout: "Logout",
    heroTitle: "How can we help you today?",
    heroBody: "Describe the issue naturally, and the assigned support agent will respond while keeping the full conversation in one workspace.",
    draftPlaceholder: "Example: The evidence document for Ulsan Plant No. 3 still shows as missing after upload.",
    attachFile: "Attach File",
    uploadCapture: "Upload Screenshot",
    startInquiry: "Start Inquiry",
    quickKeywords: "Quick Keywords",
    keywordItems: ["Emission input error", "Login / account", "Evidence requirements", "Site registration"],
    historyTitle: "My Inquiry History",
    historyBody: "Reopen previous inquiries, review the latest progress, and continue the conversation with new materials.",
    historySearch: "Search inquiries...",
    filter: "Filter",
    allStatus: "All Status",
    activeAgent: "Assigned Agent",
    onlineReady: "Online and ready to help",
    typeMessage: "Type a message...",
    moreActions: "More actions",
    callAgent: "Call agent",
    addAttachment: "Add attachment",
    emoji: "Emoji",
    viewMoreHistory: "View more history",
    noResultTitle: "No results found.",
    noResultBody: "Try clearing the keyword or changing the status filter.",
    metrics: [
      { label: "Open inquiries", value: "03", tone: "amber" },
      { label: "Created today", value: "02", tone: "indigo" },
      { label: "Recently closed", value: "11", tone: "emerald" }
    ],
    footerOrg: "CCUS Integrated Management Headquarters",
    footerAddress: "(04551) 110 Sejong-daero, Jung-gu, Seoul | Support Center: 02-1234-5678 (Weekdays 09:00-18:00)",
    footerCopyright: "© 2025 CCUS Carbon Footprint Platform. All rights reserved.",
    footerLastModifiedLabel: "Last Updated:",
    footerWaAlt: "Web Accessibility Quality Mark"
  }
};

const THREADS: Record<"ko" | "en", Thread[]> = {
  ko: [
    {
      id: "INQ-2026-0412",
      status: "waiting",
      title: "울산 제3 화학기지 산정 증빙 서류 누락 건",
      preview: "상담원: 업로드 파일 중 암호화된 PDF가 있는지 먼저 확인 부탁드립니다.",
      date: "방금 전",
      agentName: "김민준 선임",
      agentStatus: "현재 응답 가능",
      dateLabel: "2026년 4월 2일",
      messages: [
        { id: "m1", author: "user", body: "안녕하세요. 울산 제3 화학기지에서 증빙 서류를 업로드했는데 계속 '누락' 상태로 뜹니다. PDF이고 용량도 5MB 이하입니다. 확인 부탁드립니다.", time: "오전 10:15", readLabel: "읽음" },
        { id: "m2", author: "agent", body: "안녕하세요, 이현장 관리자님. 로그를 확인해 보니 업로드 파일 중 하나가 암호화되어 시스템이 내용을 읽지 못한 것으로 보입니다. 보안 설정 여부를 확인해 주실 수 있을까요?", time: "오전 10:22" },
        { id: "m3", author: "user", body: "회사 보안 프로그램 때문에 자동 암호화가 걸린 것 같습니다. 보안 해제본을 다시 전달드리겠습니다.", time: "오전 10:25", readLabel: "읽음" },
        { id: "m4", author: "agent", body: "네, 여기에서 바로 첨부해 주시면 확인 후 처리 상태를 정상으로 변경하겠습니다.", time: "오전 10:26" }
      ]
    },
    {
      id: "INQ-2026-0397",
      status: "answered",
      title: "에너지공단 검증 1단계 피드백 요청",
      preview: "관리자: 1단계 통과 이후 다음 프로세스 일정이 어떻게 되나요?",
      date: "2026.03.28",
      agentName: "박소연 책임",
      agentStatus: "최근 응답 2시간 전",
      dateLabel: "2026년 3월 28일",
      messages: [
        { id: "m1", author: "user", body: "1단계 검증 통과 이후 2단계 일정이 언제 열리는지 확인 부탁드립니다.", time: "오후 2:11", readLabel: "읽음" },
        { id: "m2", author: "agent", body: "다음 단계 접수창은 4월 8일 오전 9시에 열릴 예정입니다. 사전 제출 자료는 자료실 공지에 정리해 두었습니다.", time: "오후 2:34" }
      ]
    },
    {
      id: "INQ-2026-0344",
      status: "closed",
      title: "포항 제1공장 데이터 대조 오류 해결",
      preview: "상담원: 조치가 완료되었습니다. 다시 확인 부탁드립니다.",
      date: "2026.03.21",
      agentName: "김민준 선임",
      agentStatus: "문의 종결",
      dateLabel: "2026년 3월 21일",
      messages: [
        { id: "m1", author: "user", body: "전력 사용량 CSV 업로드 후 대조 오류가 계속 발생합니다.", time: "오전 9:02", readLabel: "읽음" },
        { id: "m2", author: "agent", body: "헤더 컬럼 순서를 수정해 드렸습니다. 다시 업로드해 보시면 정상 반영됩니다.", time: "오전 9:34" },
        { id: "m3", author: "user", body: "정상 반영 확인했습니다. 감사합니다.", time: "오전 9:40", readLabel: "읽음" }
      ]
    }
  ],
  en: [
    {
      id: "INQ-2026-0412",
      status: "waiting",
      title: "Missing evidence documents for Ulsan Plant No. 3",
      preview: "Agent: Please check whether one of the uploaded PDFs is encrypted.",
      date: "Just now",
      agentName: "Min-jun Kim",
      agentStatus: "Online and ready to help",
      dateLabel: "April 2, 2026",
      messages: [
        { id: "m1", author: "user", body: "Hello. The evidence documents for Ulsan Plant No. 3 still show as missing after upload. The file is PDF and under 5MB.", time: "10:15 AM", readLabel: "Read" },
        { id: "m2", author: "agent", body: "Hello, Manager Lee. I checked the logs and one of the uploaded files appears to be encrypted, so the platform could not parse it. Could you verify the security setting?", time: "10:22 AM" },
        { id: "m3", author: "user", body: "It may have been encrypted automatically by our security software. I will send the unlocked original file again.", time: "10:25 AM", readLabel: "Read" },
        { id: "m4", author: "agent", body: "Yes, please attach it here directly and I will update the processing status right away.", time: "10:26 AM" }
      ]
    },
    {
      id: "INQ-2026-0397",
      status: "answered",
      title: "Question about phase 2 schedule after verification stage 1",
      preview: "Manager: When does the next process begin after stage 1 passes?",
      date: "2026.03.28",
      agentName: "So-yeon Park",
      agentStatus: "Last response 2 hours ago",
      dateLabel: "March 28, 2026",
      messages: [
        { id: "m1", author: "user", body: "Please confirm when phase 2 opens after stage 1 verification is completed.", time: "2:11 PM", readLabel: "Read" },
        { id: "m2", author: "agent", body: "The next intake window is scheduled to open at 9:00 AM on April 8. The pre-submission checklist is posted in the library notice.", time: "2:34 PM" }
      ]
    },
    {
      id: "INQ-2026-0344",
      status: "closed",
      title: "Pohang Plant 1 data reconciliation issue resolved",
      preview: "Agent: The fix has been applied. Please check again.",
      date: "2026.03.21",
      agentName: "Min-jun Kim",
      agentStatus: "Inquiry closed",
      dateLabel: "March 21, 2026",
      messages: [
        { id: "m1", author: "user", body: "The electricity usage CSV keeps failing during reconciliation.", time: "9:02 AM", readLabel: "Read" },
        { id: "m2", author: "agent", body: "I corrected the header column order. Please upload it again and it should pass normally.", time: "9:34 AM" },
        { id: "m3", author: "user", body: "Confirmed. It works now. Thank you.", time: "9:40 AM", readLabel: "Read" }
      ]
    }
  ]
};

function statusLabel(status: Thread["status"], en: boolean) {
  if (status === "waiting") return en ? "Awaiting Reply" : "답변 대기";
  if (status === "answered") return en ? "Answered" : "답변 완료";
  return en ? "Closed" : "문의 종결";
}

function statusClass(status: Thread["status"]) {
  if (status === "waiting") return "border-amber-200 bg-amber-50 text-amber-700";
  if (status === "answered") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  return "border-slate-200 bg-slate-100 text-slate-600";
}

function metricClass(tone: string) {
  if (tone === "amber") return "border-amber-200/70 bg-amber-400/15";
  if (tone === "emerald") return "border-emerald-200/70 bg-emerald-400/15";
  return "border-indigo-200/70 bg-indigo-400/15";
}

export function SupportInquiryMigrationPage() {
  const en = isEnglish();
  const copy = COPY[en ? "en" : "ko"];
  const baseThreads = THREADS[en ? "en" : "ko"];
  const [threads, setThreads] = useState(baseThreads);
  const [selectedId, setSelectedId] = useState(baseThreads[0]?.id ?? "");
  const [heroDraft, setHeroDraft] = useState("");
  const [messageDraft, setMessageDraft] = useState("");
  const [keyword, setKeyword] = useState("");
  const [status, setStatus] = useState<"ALL" | Thread["status"]>("ALL");

  useEffect(() => {
    setThreads(baseThreads);
    setSelectedId(baseThreads[0]?.id ?? "");
    setHeroDraft("");
    setMessageDraft("");
    setKeyword("");
    setStatus("ALL");
  }, [baseThreads]);

  const filteredThreads = threads.filter((thread) => {
    const lookup = `${thread.id} ${thread.title} ${thread.preview}`.toLowerCase();
    const matchesKeyword = !keyword.trim() || lookup.includes(keyword.trim().toLowerCase());
    const matchesStatus = status === "ALL" || thread.status === status;
    return matchesKeyword && matchesStatus;
  });

  const selectedThread = filteredThreads.find((thread) => thread.id === selectedId)
    || threads.find((thread) => thread.id === selectedId)
    || filteredThreads[0]
    || threads[0]
    || null;

  useEffect(() => {
    if (selectedThread && selectedId !== selectedThread.id) {
      setSelectedId(selectedThread.id);
    }
  }, [selectedId, selectedThread]);

  useEffect(() => {
    logGovernanceScope("PAGE", "support-inquiry", {
      language: en ? "en" : "ko",
      selectedInquiryId: selectedThread?.id || "",
      statusFilter: status,
      keyword,
      resultCount: filteredThreads.length
    });
  }, [en, filteredThreads.length, keyword, selectedThread?.id, status]);

  function handleCreateInquiry() {
    const content = heroDraft.trim();
    if (!content) {
      return;
    }
    const newThread: Thread = {
      id: `INQ-NEW-${threads.length + 1}`,
      status: "waiting",
      title: content.slice(0, 42),
      preview: `${en ? "Manager" : "관리자"}: ${content}`,
      date: en ? "Just now" : "방금 전",
      agentName: en ? "Routing Queue" : "문의 접수 대기",
      agentStatus: en ? "Assignment pending" : "상담원 배정 대기",
      dateLabel: en ? "Today" : "오늘",
      messages: [{ id: `new-${Date.now()}`, author: "user", body: content, time: en ? "Now" : "지금", readLabel: en ? "Sent" : "전송됨" }]
    };
    setThreads([newThread, ...threads]);
    setSelectedId(newThread.id);
    setHeroDraft("");
  }

  function handleSendMessage() {
    const content = messageDraft.trim();
    if (!content || !selectedThread) {
      return;
    }
    setThreads((current) => current.map((thread) => {
      if (thread.id !== selectedThread.id) {
        return thread;
      }
      return {
        ...thread,
        status: thread.status === "closed" ? "answered" : thread.status,
        preview: `${en ? "Manager" : "관리자"}: ${content}`,
        date: en ? "Just now" : "방금 전",
        messages: [...thread.messages, { id: `reply-${Date.now()}`, author: "user", body: content, time: en ? "Now" : "지금", readLabel: en ? "Sent" : "전송됨" }]
      };
    }));
    setMessageDraft("");
  }

  return (
    <div
      className="min-h-screen bg-[#f8fafc] text-[var(--kr-gov-text-primary)]"
      style={{
        ["--kr-gov-blue" as string]: "#00378b",
        ["--kr-gov-blue-hover" as string]: "#002d72",
        ["--kr-gov-text-primary" as string]: "#1a1a1a",
        ["--kr-gov-text-secondary" as string]: "#4d4d4d",
        ["--kr-gov-border-light" as string]: "#d9d9d9",
        ["--kr-gov-bg-gray" as string]: "#f2f2f2",
        ["--kr-gov-radius" as string]: "8px"
      }}
    >
      <a className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-[var(--kr-gov-blue)] focus:px-4 focus:py-3 focus:text-white" href="#main-content">
        {copy.skip}
      </a>
      <UserGovernmentBar governmentText={copy.government} guidelineText={copy.guideline} />
      <UserPortalHeader
        brandSubtitle={copy.brandSubtitle}
        brandTitle={copy.brandTitle}
        homeHref={copy.homePath}
        rightContent={(
          <div className="flex items-center gap-4">
            <UserLanguageToggle en={en} onEn={() => navigate("/en/support/inquiry")} onKo={() => navigate("/support/inquiry")} />
            <div className="hidden md:flex flex-col items-end">
              <span className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{copy.displayRole}</span>
              <span className="text-sm font-black text-[var(--kr-gov-text-primary)]">{copy.displayName}</span>
            </div>
            <HomeButton className="min-h-0 rounded-[var(--kr-gov-radius)] px-4 py-2 text-sm" type="button" variant="primary">
              {copy.logout}
            </HomeButton>
          </div>
        )}
      />

      <main id="main-content">
        <section className="relative overflow-hidden bg-[#0f172a] pb-14 pt-16" data-help-id="support-inquiry-hero">
          <div className="absolute inset-0 opacity-10">
            <div className="h-full w-full bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.9)_1px,transparent_0)] bg-[length:48px_48px]" />
          </div>
          <div className="relative z-10 mx-auto max-w-[1000px] px-4">
            <div className="mb-8 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-indigo-500 shadow-xl shadow-indigo-500/20">
                <span className="material-symbols-outlined text-[32px] text-white">psychology</span>
              </div>
              <h1 className="text-3xl font-black text-white md:text-4xl">{copy.heroTitle}</h1>
              <p className="mx-auto mt-3 max-w-[760px] text-sm leading-6 text-indigo-100 md:text-base">{copy.heroBody}</p>
            </div>

            <div className="rounded-[28px] border border-white/15 bg-white/10 p-6 shadow-2xl backdrop-blur-md">
              <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
                <textarea
                  className="min-h-[116px] w-full resize-none rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-white placeholder:text-indigo-100/50 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-400/60"
                  onChange={(event) => setHeroDraft(event.target.value)}
                  placeholder={copy.draftPlaceholder}
                  value={heroDraft}
                />
                <button className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-indigo-500 px-8 text-sm font-bold text-white shadow-lg shadow-indigo-500/30 transition hover:bg-indigo-400" onClick={handleCreateInquiry} type="button">
                  {copy.startInquiry}
                  <span className="material-symbols-outlined text-[20px]">send</span>
                </button>
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-2">
                  <button className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-indigo-100 transition hover:bg-white/10" type="button">
                    <span className="material-symbols-outlined text-[16px]">attach_file</span>
                    {copy.attachFile}
                  </button>
                  <button className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-indigo-100 transition hover:bg-white/10" type="button">
                    <span className="material-symbols-outlined text-[16px]">image</span>
                    {copy.uploadCapture}
                  </button>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <span className="text-[11px] font-black uppercase tracking-[0.24em] text-white/45">{copy.quickKeywords}</span>
                  {copy.keywordItems.map((item) => (
                    <button className="rounded-md border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-bold text-indigo-100 transition hover:bg-white/10" key={item} onClick={() => setHeroDraft(item)} type="button">
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-3">
              {copy.metrics.map((metric) => (
                <div className={`rounded-2xl border px-5 py-4 text-white backdrop-blur ${metricClass(metric.tone)}`} key={metric.label}>
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-white/70">{metric.label}</p>
                  <p className="mt-2 text-3xl font-black">{metric.value}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[1440px] px-4 py-12 lg:px-8">
          <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between" data-help-id="support-inquiry-filters">
            <div>
              <h2 className="flex items-center gap-2 text-2xl font-black text-slate-800">
                <span className="material-symbols-outlined text-[var(--kr-gov-blue)]">forum</span>
                {copy.historyTitle}
              </h2>
              <p className="mt-2 text-sm text-slate-500">{copy.historyBody}</p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="flex items-center rounded-xl border border-gray-200 bg-white px-3 py-2 shadow-sm">
                <span className="material-symbols-outlined mr-2 text-[18px] text-gray-400">search</span>
                <input className="w-52 border-none p-0 text-sm focus:outline-none focus:ring-0" onChange={(event) => setKeyword(event.target.value)} placeholder={copy.historySearch} type="text" value={keyword} />
              </div>
              <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-3 py-2 shadow-sm">
                <span className="material-symbols-outlined text-[18px] text-gray-400">filter_list</span>
                <label className="text-xs font-bold text-slate-500" htmlFor="support-inquiry-status">{copy.filter}</label>
                <select
                  className="border-none bg-transparent pr-6 text-sm font-medium text-slate-700 focus:outline-none focus:ring-0"
                  id="support-inquiry-status"
                  onChange={(event) => setStatus(event.target.value as "ALL" | Thread["status"])}
                  value={status}
                >
                  <option value="ALL">{copy.allStatus}</option>
                  <option value="waiting">{statusLabel("waiting", en)}</option>
                  <option value="answered">{statusLabel("answered", en)}</option>
                  <option value="closed">{statusLabel("closed", en)}</option>
                </select>
              </div>
            </div>
          </div>

          <div className="grid items-start gap-8 lg:grid-cols-12">
            <div className="space-y-4 lg:col-span-4" data-help-id="support-inquiry-thread-list">
              {filteredThreads.length ? filteredThreads.map((thread) => (
                <button
                  className={`w-full rounded-2xl border bg-white p-5 text-left shadow-sm transition hover:-translate-y-[1px] hover:shadow-md ${selectedThread?.id === thread.id ? "border-[var(--kr-gov-blue)] ring-2 ring-[var(--kr-gov-blue)]/15" : "border-gray-200"}`}
                  key={thread.id}
                  onClick={() => setSelectedId(thread.id)}
                  type="button"
                >
                  <div className="mb-3 flex items-start justify-between gap-4">
                    <span className={`rounded border px-2 py-0.5 text-[10px] font-black ${statusClass(thread.status)}`}>{statusLabel(thread.status, en)}</span>
                    <span className="text-[10px] font-medium text-gray-400">{thread.date}</span>
                  </div>
                  <h3 className="line-clamp-1 text-sm font-bold text-gray-900">{thread.title}</h3>
                  <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-gray-500">{thread.preview}</p>
                  <div className="mt-4 flex items-center justify-between text-[11px] text-slate-400">
                    <span className="font-mono">{thread.id}</span>
                    <span>{thread.agentName}</span>
                  </div>
                </button>
              )) : (
                <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-5 py-10 text-center shadow-sm">
                  <p className="text-sm font-bold text-slate-700">{copy.noResultTitle}</p>
                  <p className="mt-2 text-xs leading-6 text-slate-500">{copy.noResultBody}</p>
                </div>
              )}
              <button className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-gray-200 bg-white py-4 text-sm font-bold text-gray-400 transition hover:border-[var(--kr-gov-blue)] hover:text-[var(--kr-gov-blue)]" type="button">
                <span className="material-symbols-outlined">history</span>
                {copy.viewMoreHistory}
              </button>
            </div>

            <div className="flex min-h-[700px] flex-col overflow-hidden rounded-[28px] border border-gray-200 bg-white shadow-sm lg:col-span-8" data-help-id="support-inquiry-chat">
              {selectedThread ? (
                <>
                  <div className="flex items-center justify-between border-b border-gray-100 bg-slate-50/70 p-6">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100">
                        <span className="material-symbols-outlined text-indigo-600">support_agent</span>
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-gray-900">{copy.activeAgent}: {selectedThread.agentName}</h3>
                        <p className="flex items-center gap-1 text-[10px] font-bold text-emerald-600">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          {selectedThread.agentStatus || copy.onlineReady}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button aria-label={copy.callAgent} className="flex h-9 w-9 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-200 hover:text-gray-600" type="button">
                        <span className="material-symbols-outlined text-[20px]">phone_in_talk</span>
                      </button>
                      <button aria-label={copy.moreActions} className="flex h-9 w-9 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-200 hover:text-gray-600" type="button">
                        <span className="material-symbols-outlined text-[20px]">more_vert</span>
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 space-y-6 overflow-y-auto bg-slate-50/40 p-6">
                    <div className="text-center">
                      <span className="inline-block rounded-full bg-gray-200/60 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-gray-500">{selectedThread.dateLabel}</span>
                    </div>
                    {selectedThread.messages.map((message) => (
                      <div className={message.author === "user" ? "flex flex-col items-end gap-1" : "flex gap-3"} key={message.id}>
                        {message.author === "agent" ? (
                          <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-500">
                            <span className="material-symbols-outlined text-[18px] text-white">support_agent</span>
                          </div>
                        ) : null}
                        <div className={message.author === "agent" ? "flex flex-col items-start gap-1" : ""}>
                          <div className={message.author === "user" ? "max-w-[85%] rounded-2xl rounded-tr-none bg-[var(--kr-gov-blue)] px-4 py-3 text-sm leading-7 text-white" : "max-w-[85%] rounded-2xl rounded-tl-none border border-gray-200 bg-white px-4 py-3 text-sm leading-7 text-gray-800"}>
                            {message.body}
                          </div>
                          <span className={message.author === "user" ? "mr-1 text-[10px] text-gray-400" : "ml-1 text-[10px] text-gray-400"}>
                            {message.time}{message.readLabel ? ` · ${message.readLabel}` : ""}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="border-t border-gray-100 bg-white p-4">
                    <div className="flex items-end gap-2 rounded-2xl border border-gray-200 bg-gray-50 p-2 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-500/20">
                      <button aria-label={copy.addAttachment} className="p-2 text-gray-400 transition hover:text-gray-600" type="button">
                        <span className="material-symbols-outlined">add_circle</span>
                      </button>
                      <textarea className="min-h-[44px] max-h-32 flex-1 resize-none bg-transparent p-2 text-sm focus:outline-none" onChange={(event) => setMessageDraft(event.target.value)} placeholder={copy.typeMessage} rows={1} value={messageDraft} />
                      <button aria-label={copy.emoji} className="p-2 text-gray-400 transition hover:text-gray-600" type="button">
                        <span className="material-symbols-outlined">mood</span>
                      </button>
                      <button className="rounded-xl bg-[var(--kr-gov-blue)] p-2 text-white transition hover:bg-[var(--kr-gov-blue-hover)]" onClick={handleSendMessage} type="button">
                        <span className="material-symbols-outlined text-[20px]">send</span>
                      </button>
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </section>
      </main>

      <UserPortalFooter
        addressLine={copy.footerAddress}
        copyright={copy.footerCopyright}
        lastModifiedLabel={copy.footerLastModifiedLabel}
        orgName={copy.footerOrg}
        waAlt={copy.footerWaAlt}
      />
    </div>
  );
}
