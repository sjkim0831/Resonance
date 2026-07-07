import { ChangeEvent, FormEvent, useMemo, useRef, useState } from "react";
import {
  UserGovernmentBar,
  UserLanguageToggle,
  UserPortalFooter,
  UserPortalHeader
} from "../../components/user-shell/UserPortalChrome";
import { buildLocalizedPath, isEnglish, navigate } from "../../lib/navigation/runtime";

type CopySet = {
  skip: string;
  government: string;
  guideline: string;
  supportLine: string;
  brandTitle: string;
  brandSubtitle: string;
  role: string;
  managerName: string;
  logout: string;
  supportBadge: string;
  heroTitle: string;
  heroBody: string;
  assistantTitle: string;
  assistantStatus: string;
  resetChat: string;
  introTitle: string;
  introBody: string;
  suggestionTitle: string;
  inputPlaceholder: string;
  assistantFollowUp: string;
  downloadTemplate: string;
  formTitle: string;
  formBody: string;
  inquiryType: string;
  inquirySite: string;
  subject: string;
  description: string;
  attachment: string;
  attachmentHint: string;
  attachmentSubHint: string;
  aiIncluded: string;
  cancel: string;
  submit: string;
  success: string;
  footerOrg: string;
  footerAddress: string;
  footerService: string;
  footerCopyright: string;
  footerLastModifiedLabel: string;
  footerWaAlt: string;
  footerLinks: string[];
};

type ChatMessage = {
  id: string;
  speaker: "assistant" | "user";
  body: string;
  ctaLabel?: string;
};

type InquiryOption = {
  value: string;
  labelKo: string;
  labelEn: string;
};

const COPY: Record<"ko" | "en", CopySet> = {
  ko: {
    skip: "본문 바로가기",
    government: "대한민국 정부 공식 서비스",
    guideline: "현장 운영자를 위한 고객지원 포털",
    supportLine: "고객센터 1588-0000",
    brandTitle: "Emission Integrated Dashboard",
    brandSubtitle: "Support Center",
    role: "General Supervisor",
    managerName: "Admin Lee Hyeon-jang",
    logout: "로그아웃",
    supportBadge: "HYBRID AI SUPPORT ENABLED",
    heroTitle: "무엇을 도와드릴까요?",
    heroBody: "AI가 먼저 답변하고, 해결되지 않으면 담당자가 직접 검토합니다.",
    assistantTitle: "Intelligent Support Assistant",
    assistantStatus: "Online",
    resetChat: "대화 초기화",
    introTitle: "CCUS 통합관리 도우미입니다.",
    introBody: "배출량 산정 로직, 증빙 제출 절차, 시스템 오류를 문의하실 수 있습니다.",
    suggestionTitle: "추천 질문",
    inputPlaceholder: "추가 질문을 입력하세요.",
    assistantFollowUp: "문제가 계속되면 아래 1:1 문의로 접수해 주세요. AI 대화 이력은 함께 전달됩니다.",
    downloadTemplate: "새 계산 템플릿 다운로드",
    formTitle: "Agent 1:1 Inquiry",
    formBody: "AI 응답만으로 해결되지 않았다면 상세 내용을 남겨 주세요. AI 채팅 이력이 참고자료로 포함됩니다.",
    inquiryType: "문의 유형",
    inquirySite: "관련 배출시설 선택",
    subject: "문의 제목",
    description: "상세 설명",
    attachment: "첨부파일",
    attachmentHint: "파일을 끌어오거나 클릭해서 업로드",
    attachmentSubHint: "파일당 최대 20MB, JPG/PNG/PDF/XLSX 지원",
    aiIncluded: "AI Context Included",
    cancel: "취소",
    submit: "문의 등록",
    success: "문의가 등록되었습니다. 운영 담당자가 AI 대화 이력과 첨부파일을 함께 검토합니다.",
    footerOrg: "CCUS Integrated Management Headquarters",
    footerAddress: "(04551) 110 Sejong-daero, Jung-gu, Seoul | Support Center: 1588-0000",
    footerService: "이 플랫폼은 기업 온실가스 감축 현장 운영을 지원합니다.",
    footerCopyright: "© 2025 CCUS Carbon Footprint Platform. Support Center.",
    footerLastModifiedLabel: "최종 수정일:",
    footerWaAlt: "웹 접근성 품질인증 마크",
    footerLinks: ["개인정보처리방침", "이용약관", "다운로드 매뉴얼"]
  },
  en: {
    skip: "Skip to main content",
    government: "Official Government Service",
    guideline: "Field Supervisor Portal",
    supportLine: "Support Center 1588-0000",
    brandTitle: "Emission Integrated Dashboard",
    brandSubtitle: "Support Center",
    role: "General Supervisor",
    managerName: "Admin Lee Hyeon-jang",
    logout: "Logout",
    supportBadge: "HYBRID AI SUPPORT ENABLED",
    heroTitle: "How can we help you today?",
    heroBody: "Our AI assistant responds first. If the issue persists, a representative assists directly.",
    assistantTitle: "Intelligent Support Assistant",
    assistantStatus: "Online",
    resetChat: "Reset Chat",
    introTitle: "Hello, I am your CCUS Integrated Management Assistant.",
    introBody: "Ask about emission calculation logic, document submission procedures, or system errors.",
    suggestionTitle: "Suggested prompts",
    inputPlaceholder: "Type your follow-up question.",
    assistantFollowUp: "If the issue continues, submit the 1:1 inquiry below. The AI chat history will be included.",
    downloadTemplate: "Download New Calculation Template",
    formTitle: "Agent 1:1 Inquiry",
    formBody: "If the AI response was insufficient, provide the details below. Your AI chat history will be included as reference material.",
    inquiryType: "Inquiry Type",
    inquirySite: "Select Related Emission Site",
    subject: "Inquiry Subject",
    description: "Detailed Description",
    attachment: "Attachments",
    attachmentHint: "Drag files here or click to upload",
    attachmentSubHint: "Max 20MB per file. JPG, PNG, PDF, XLSX supported.",
    aiIncluded: "AI Context Included",
    cancel: "Cancel",
    submit: "Submit Inquiry",
    success: "Your inquiry has been submitted. The support team will review the AI chat history and attachments together.",
    footerOrg: "CCUS Integrated Management Headquarters",
    footerAddress: "(04551) 110 Sejong-daero, Jung-gu, Seoul | Support Center: 1588-0000",
    footerService: "This platform is optimized for corporate greenhouse gas reduction site management.",
    footerCopyright: "© 2025 CCUS Carbon Footprint Platform. Support Center.",
    footerLastModifiedLabel: "Last Modified:",
    footerWaAlt: "Web Accessibility Quality Mark",
    footerLinks: ["Privacy Policy", "Terms of Use", "Download Manual"]
  }
};

const SUGGESTIONS = [
  { id: "factor", labelKo: "배출계수 확인 방법", labelEn: "How to check emission factors" },
  { id: "reject", labelKo: "증빙 반려 사유", labelEn: "Reason for document rejection" },
  { id: "password", labelKo: "비밀번호 변경", labelEn: "Change Password" }
] as const;

const CHAT_LOG: Record<"ko" | "en", ChatMessage[]> = {
  ko: [
    {
      id: "intro",
      speaker: "assistant",
      body: "안녕하세요. CCUS 통합관리 도우미입니다. 배출량 산정 로직, 증빙 제출 절차, 시스템 오류를 문의해 주세요."
    },
    {
      id: "user",
      speaker: "user",
      body: "울산화학기지 3호기에서 배출계수 산정 오류가 발생합니다. Tier 3 로직을 적용했는데 인식하지 못합니다."
    },
    {
      id: "assistant",
      speaker: "assistant",
      body: "검토 결과 울산화학기지 3호기는 2025-02 개정 화학공정 배출계수 업데이트가 적용되었습니다. Tier 3 계산 시 새 템플릿 v2.1을 사용해야 합니다.",
      ctaLabel: "새 계산 템플릿 다운로드"
    }
  ],
  en: [
    {
      id: "intro",
      speaker: "assistant",
      body: "Hello, I am your CCUS Integrated Management Assistant. Ask about emission calculation logic, document submission procedures, or system errors."
    },
    {
      id: "user",
      speaker: "user",
      body: "I'm getting an error calculating emission factors for Ulsan Chemical Base No. 3. I applied Tier 3 logic, but the system doesn't recognize it."
    },
    {
      id: "assistant",
      speaker: "assistant",
      body: "Upon review, Ulsan Chemical Base No. 3 uses the 2025-02 chemical process emission factor update. You must use the new v2.1 template for Tier 3 calculations.",
      ctaLabel: "Download New Calculation Template"
    }
  ]
};

const INQUIRY_TYPES: InquiryOption[] = [
  { value: "logic", labelKo: "데이터 산정 및 로직 문의", labelEn: "Data Calculation & Logic Inquiry" },
  { value: "document", labelKo: "증빙서류 및 검증 지원", labelEn: "Documentation & Verification Support" },
  { value: "system", labelKo: "시스템 기능 및 오류 신고", labelEn: "System Features & Error Reporting" },
  { value: "account", labelKo: "계정 및 권한 관리", labelEn: "Account & Permission Management" },
  { value: "other", labelKo: "기타", labelEn: "Other" }
];

const EMISSION_SITES: InquiryOption[] = [
  { value: "ulsan", labelKo: "울산화학기지 3호기 (US-042)", labelEn: "Ulsan Chemical Base No. 3 (US-042)" },
  { value: "pohang", labelKo: "포항 제1열연공장 (PH-001)", labelEn: "Pohang No. 1 Hot Rolling Mill (PH-001)" },
  { value: "gwangyang", labelKo: "광양 제2에너지센터 (GN-112)", labelEn: "Gwangyang No. 2 Energy Center (GN-112)" },
  { value: "all", labelKo: "해당 없음 / 전체 사업장", labelEn: "Not Applicable / All Sites" }
];

function optionLabel(option: InquiryOption, en: boolean) {
  return en ? option.labelEn : option.labelKo;
}

function AttachmentRow(props: { fileName: string }) {
  return (
    <div className="mt-3 flex items-center justify-between rounded-lg border border-blue-100 bg-blue-50/70 px-3 py-3">
      <div className="flex items-center gap-2">
        <span className="material-symbols-outlined text-sm text-blue-600">description</span>
        <span className="text-xs font-bold text-slate-700">{props.fileName}</span>
      </div>
      <span className="material-symbols-outlined text-[18px] text-slate-400">close</span>
    </div>
  );
}

export function MyInquiryMigrationPage() {
  const en = isEnglish();
  const copy = COPY[en ? "en" : "ko"];
  const chatLog = useMemo(() => CHAT_LOG[en ? "en" : "ko"], [en]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [chatDraft, setChatDraft] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [inquiryType, setInquiryType] = useState(INQUIRY_TYPES[0].value);
  const [emissionSite, setEmissionSite] = useState(EMISSION_SITES[0].value);
  const [subject, setSubject] = useState(
    en
      ? "Detailed Review Request regarding Tier 3 Calculation Logic Recognition Error at Ulsan Chemical Base No. 3"
      : "울산화학기지 3호기 Tier 3 계산 로직 인식 오류 상세 검토 요청"
  );
  const [description, setDescription] = useState(
    en
      ? "As discussed in the chat above, I uploaded data applying Tier 3 calculation logic, but the system continues to throw a format mismatch error. Please cross-check the data and investigate the system logs."
      : "위 AI 상담 내용과 같이 Tier 3 계산 로직을 적용한 데이터를 업로드했으나 형식 불일치 오류가 계속 발생합니다. 데이터와 시스템 로그를 함께 점검해 주세요."
  );
  const [attachments, setAttachments] = useState<string[]>(["ulsan_chemical_tier3_calculation_error.log"]);

  const quickSuggestions = SUGGESTIONS.map((item) => ({
    id: item.id,
    label: en ? item.labelEn : item.labelKo
  }));

  function handleAttachmentChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []).map((file) => file.name);
    if (files.length) {
      setAttachments((current) => Array.from(new Set([...current, ...files])));
    }
    event.target.value = "";
  }

  function handleReset() {
    setChatDraft("");
    setSubmitted(false);
    setInquiryType(INQUIRY_TYPES[0].value);
    setEmissionSite(EMISSION_SITES[0].value);
    setAttachments(["ulsan_chemical_tier3_calculation_error.log"]);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
  }

  return (
    <div
      className="min-h-screen bg-[#f4f7fa] text-[var(--kr-gov-text-primary)]"
      style={{
        ["--kr-gov-blue" as string]: "#00378b",
        ["--kr-gov-blue-hover" as string]: "#002d72",
        ["--kr-gov-text-primary" as string]: "#1a1a1a",
        ["--kr-gov-text-secondary" as string]: "#4d4d4d",
        ["--kr-gov-border-light" as string]: "#d9d9d9",
        ["--kr-gov-bg-gray" as string]: "#f2f2f2",
        ["--kr-gov-radius" as string]: "5px"
      }}
    >
      <a className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-[var(--kr-gov-blue)] focus:px-4 focus:py-3 focus:text-white" href="#main-content">
        {copy.skip}
      </a>

      <UserGovernmentBar governmentText={copy.government} guidelineText={copy.guideline} />

      <div className="border-b border-[var(--kr-gov-border-light)] bg-[var(--kr-gov-bg-gray)]">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between px-4 py-2 text-xs font-medium text-[var(--kr-gov-text-secondary)] lg:px-8">
          <span>{copy.government} | {copy.guideline}</span>
          <span className="hidden md:inline">{copy.supportLine}</span>
        </div>
      </div>

      <UserPortalHeader
        brandTitle={copy.brandTitle}
        brandSubtitle={copy.brandSubtitle}
        homeHref={buildLocalizedPath("/home", "/en/home")}
        rightContent={(
          <>
            <nav className="hidden xl:flex items-center space-x-1 h-full ml-12 flex-1">
              <button className="h-full border-b-4 border-transparent px-4 text-[16px] font-bold text-gray-500" onClick={() => navigate(buildLocalizedPath("/monitoring/dashboard", "/en/monitoring/dashboard"))} type="button">
                {en ? "Site Monitoring" : "현장 모니터링"}
              </button>
              <button className="h-full border-b-4 border-transparent px-4 text-[16px] font-bold text-gray-500" onClick={() => navigate(buildLocalizedPath("/emission/validate", "/en/emission/validate"))} type="button">
                {en ? "Data Calculation" : "데이터 산정"}
              </button>
              <button className="h-full border-b-4 border-transparent px-4 text-[16px] font-bold text-gray-500" onClick={() => navigate(buildLocalizedPath("/certificate/list", "/en/certificate/list"))} type="button">
                {en ? "Reports & Verification" : "보고서 및 검증"}
              </button>
              <button className="h-full border-b-4 border-[var(--kr-gov-blue)] px-4 text-[16px] font-bold text-[var(--kr-gov-blue)]" type="button">
                {en ? "Support" : "고객지원"}
              </button>
            </nav>
            <div className="hidden md:flex flex-col items-end">
              <span className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{copy.role}</span>
              <span className="text-sm font-black text-[var(--kr-gov-text-primary)]">{copy.managerName}</span>
            </div>
            <UserLanguageToggle
              en={en}
              onKo={() => navigate("/mtn/my_inquiry")}
              onEn={() => navigate("/en/mtn/my_inquiry")}
            />
            <button className="rounded-[var(--kr-gov-radius)] bg-[var(--kr-gov-blue)] px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[var(--kr-gov-blue-hover)]" type="button">
              {copy.logout}
            </button>
          </>
        )}
      />

      <main className="pb-20" id="main-content">
        <section className="relative overflow-hidden bg-slate-900 px-4 pb-24 pt-12" data-help-id="my-inquiry-hero">
          <div className="absolute inset-0 opacity-10 pointer-events-none">
            <svg height="100%" width="100%">
              <pattern height="60" id="my-inquiry-dots" patternUnits="userSpaceOnUse" width="60">
                <circle cx="2" cy="2" fill="white" r="1" />
              </pattern>
              <rect fill="url(#my-inquiry-dots)" height="100%" width="100%" />
            </svg>
          </div>
          <div className="relative z-10 mx-auto max-w-[1000px] text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/20 px-3 py-1 text-xs font-bold text-indigo-300">
              <span className="h-2 w-2 rounded-full bg-indigo-400" />
              {copy.supportBadge}
            </div>
            <h2 className="text-4xl font-black text-white">{copy.heroTitle}</h2>
            <p className="mt-4 text-lg text-slate-400">{copy.heroBody}</p>
          </div>
        </section>

        <div className="relative z-20 mx-auto -mt-16 max-w-[1000px] px-4">
          <section className="mb-8 overflow-hidden rounded-xl border border-gray-100 bg-white shadow-xl" data-help-id="my-inquiry-chat">
            <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-600">
                  <span className="material-symbols-outlined text-[20px] text-white">smart_toy</span>
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-800">{copy.assistantTitle}</p>
                  <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-500">
                    <span className="h-1 w-1 rounded-full bg-emerald-500" />
                    {copy.assistantStatus}
                  </p>
                </div>
              </div>
              <button className="flex items-center gap-1 text-xs font-bold text-gray-400 transition-colors hover:text-gray-600" onClick={handleReset} type="button">
                <span className="material-symbols-outlined text-[16px]">refresh</span>
                {copy.resetChat}
              </button>
            </div>

            <div className="flex h-[450px] flex-col gap-6 overflow-y-auto bg-slate-50 p-6">
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-100">
                  <span className="material-symbols-outlined text-[18px] text-indigo-600">smart_toy</span>
                </div>
                <div className="max-w-[80%] rounded-2xl rounded-tl-none border border-gray-200 bg-white p-4 text-sm leading-relaxed shadow-sm">
                  <p className="font-semibold text-slate-900">{copy.introTitle}</p>
                  <p className="mt-2 text-slate-600">{copy.introBody}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {quickSuggestions.map((item) => (
                      <button
                        className="rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-600 transition-colors hover:bg-indigo-100"
                        key={item.id}
                        onClick={() => setChatDraft(item.label)}
                        type="button"
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {chatLog.slice(1).map((message) => (
                message.speaker === "user" ? (
                  <div className="self-end max-w-[80%] rounded-2xl rounded-tr-none bg-[var(--kr-gov-blue)] p-4 text-sm leading-relaxed text-white shadow-sm" key={message.id}>
                    {message.body}
                  </div>
                ) : (
                  <div className="flex items-start gap-3" key={message.id}>
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-100">
                      <span className="material-symbols-outlined text-[18px] text-indigo-600">smart_toy</span>
                    </div>
                    <div className="max-w-[80%] rounded-2xl rounded-tl-none border border-gray-200 bg-white p-4 text-sm leading-relaxed shadow-sm">
                      <p className="text-slate-700">{message.body}</p>
                      {message.ctaLabel ? (
                        <button className="mb-4 mt-3 inline-flex items-center gap-2 font-bold text-indigo-600 underline" type="button">
                          <span className="material-symbols-outlined text-[16px]">download</span>
                          {message.ctaLabel}
                        </button>
                      ) : null}
                      <p className="text-xs text-gray-500">{copy.assistantFollowUp}</p>
                    </div>
                  </div>
                )
              ))}
            </div>

            <div className="border-t border-gray-100 bg-white p-4">
              <div className="flex gap-2">
                <input
                  className="flex-1 rounded-lg bg-gray-50 px-4 py-3 text-sm outline-none ring-0 transition focus:ring-2 focus:ring-indigo-500"
                  onChange={(event) => setChatDraft(event.target.value)}
                  placeholder={copy.inputPlaceholder}
                  type="text"
                  value={chatDraft}
                />
                <button className="flex h-12 w-12 items-center justify-center rounded-lg bg-indigo-600 text-white transition hover:bg-indigo-700" type="button">
                  <span className="material-symbols-outlined">send</span>
                </button>
              </div>
            </div>
          </section>

          <section className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm" data-help-id="my-inquiry-form">
            <div className="border-b border-gray-50 p-8">
              <div className="mb-2 flex items-center gap-3">
                <span className="material-symbols-outlined text-[var(--kr-gov-blue)]">support_agent</span>
                <h3 className="text-xl font-black">{copy.formTitle}</h3>
              </div>
              <p className="text-sm text-[var(--kr-gov-text-secondary)]">{copy.formBody}</p>
            </div>

            <form className="space-y-6 p-8" onSubmit={handleSubmit}>
              {submitted ? (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
                  {copy.success}
                </div>
              ) : null}

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-bold text-[var(--kr-gov-text-primary)]" htmlFor="inquiry-type">{copy.inquiryType}</label>
                  <select
                    className="w-full rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] px-3 py-3 text-sm focus:border-[var(--kr-gov-blue)] focus:outline-none"
                    id="inquiry-type"
                    onChange={(event) => setInquiryType(event.target.value)}
                    value={inquiryType}
                  >
                    {INQUIRY_TYPES.map((option) => (
                      <option key={option.value} value={option.value}>{optionLabel(option, en)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-bold text-[var(--kr-gov-text-primary)]" htmlFor="inquiry-site">{copy.inquirySite}</label>
                  <select
                    className="w-full rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] px-3 py-3 text-sm focus:border-[var(--kr-gov-blue)] focus:outline-none"
                    id="inquiry-site"
                    onChange={(event) => setEmissionSite(event.target.value)}
                    value={emissionSite}
                  >
                    {EMISSION_SITES.map((option) => (
                      <option key={option.value} value={option.value}>{optionLabel(option, en)}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-[var(--kr-gov-text-primary)]" htmlFor="inquiry-subject">{copy.subject}</label>
                <input
                  className="w-full rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] px-3 py-3 text-sm focus:border-[var(--kr-gov-blue)] focus:outline-none"
                  id="inquiry-subject"
                  onChange={(event) => setSubject(event.target.value)}
                  type="text"
                  value={subject}
                />
              </div>

              <div>
                <div className="mb-2 flex items-end justify-between">
                  <label className="block text-sm font-bold text-[var(--kr-gov-text-primary)]" htmlFor="inquiry-description">{copy.description}</label>
                  <span className="rounded border border-indigo-100 bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-600">{copy.aiIncluded}</span>
                </div>
                <textarea
                  className="w-full resize-none rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] px-3 py-3 text-sm focus:border-[var(--kr-gov-blue)] focus:outline-none"
                  id="inquiry-description"
                  onChange={(event) => setDescription(event.target.value)}
                  rows={6}
                  value={description}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-[var(--kr-gov-text-primary)]">{copy.attachment}</label>
                <input className="hidden" multiple onChange={handleAttachmentChange} ref={fileInputRef} type="file" />
                <button
                  className="flex w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 p-8 text-center transition hover:bg-white"
                  onClick={() => fileInputRef.current?.click()}
                  type="button"
                >
                  <span className="material-symbols-outlined mb-2 text-4xl text-gray-300">cloud_upload</span>
                  <span className="text-sm font-bold text-gray-500">{copy.attachmentHint}</span>
                  <span className="mt-1 text-[11px] text-gray-400">{copy.attachmentSubHint}</span>
                </button>
                {attachments.map((fileName) => (
                  <AttachmentRow fileName={fileName} key={fileName} />
                ))}
              </div>

              <div className="flex items-center gap-4 border-t border-gray-100 pt-6">
                <button className="flex-1 rounded-[var(--kr-gov-radius)] bg-gray-100 py-4 font-black text-gray-600 transition hover:bg-gray-200" onClick={handleReset} type="button">
                  {copy.cancel}
                </button>
                <button className="flex-[2] rounded-[var(--kr-gov-radius)] bg-[var(--kr-gov-blue)] py-4 font-black text-white shadow-lg shadow-blue-900/10 transition hover:bg-[var(--kr-gov-blue-hover)]" type="submit">
                  {copy.submit}
                </button>
              </div>
            </form>
          </section>
        </div>
      </main>

      <UserPortalFooter
        addressLine={copy.footerAddress}
        copyright={copy.footerCopyright}
        footerLinks={[...copy.footerLinks]}
        lastModifiedLabel={copy.footerLastModifiedLabel}
        orgName={copy.footerOrg}
        serviceLine={copy.footerService}
        waAlt={copy.footerWaAlt}
      />
    </div>
  );
}
