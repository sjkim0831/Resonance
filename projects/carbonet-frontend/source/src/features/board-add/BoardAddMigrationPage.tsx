import { useEffect, useMemo, useState } from "react";
import { logGovernanceScope } from "../../app/policy/debug";
import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { fetchBoardDistributionPage, saveBoardDistributionPage } from "../../lib/api/content";
import type { BoardDistributionPagePayload } from "../../lib/api/contentTypes";
import { buildLocalizedPath, isEnglish, navigate } from "../../lib/navigation/runtime";
import { AdminPageShell } from "../admin-entry/AdminPageShell";
import { CollectionResultPanel, LookupContextStrip, PageStatusNotice, SummaryMetricCard } from "../admin-ui/common";
import { AdminWorkspacePageFrame } from "../admin-ui/pageFrames";
import { AdminCheckbox, AdminInput, AdminSelect, AdminTextarea, MemberButton, MemberLinkButton, MemberSectionToolbar } from "../member/common";

type ChannelKey = "PORTAL" | "EMAIL" | "PUSH";
type AudienceKey = "ALL" | "OPERATORS" | "COMPANIES" | "MEMBERS";

const CHANNEL_OPTIONS: Array<{ key: ChannelKey; labelKo: string; labelEn: string }> = [
  { key: "PORTAL", labelKo: "포털 공지", labelEn: "Portal Notice" },
  { key: "EMAIL", labelKo: "이메일 발송", labelEn: "Email Delivery" },
  { key: "PUSH", labelKo: "운영 푸시", labelEn: "Operator Push" }
];

const AUDIENCE_OPTIONS: Array<{ key: AudienceKey; labelKo: string; labelEn: string }> = [
  { key: "ALL", labelKo: "전체 회원", labelEn: "All Members" },
  { key: "OPERATORS", labelKo: "운영 관리자", labelEn: "Operators" },
  { key: "COMPANIES", labelKo: "회원사 담당자", labelEn: "Company Managers" },
  { key: "MEMBERS", labelKo: "일반 사용자", labelEn: "General Members" }
];

const TAG_OPTIONS = ["점검", "정책안내", "정산", "배출권", "보안", "서비스개선"];

function formatRecipientEstimate(audience: AudienceKey, urgent: boolean) {
  const base = audience === "ALL"
    ? 2841
    : audience === "OPERATORS"
      ? 46
      : audience === "COMPANIES"
        ? 612
        : 2183;
  return urgent ? base + Math.round(base * 0.08) : base;
}

function channelLabel(en: boolean, key: ChannelKey) {
  const matched = CHANNEL_OPTIONS.find((option) => option.key === key);
  return matched ? (en ? matched.labelEn : matched.labelKo) : key;
}

function audienceLabel(en: boolean, key: AudienceKey) {
  const matched = AUDIENCE_OPTIONS.find((option) => option.key === key);
  return matched ? (en ? matched.labelEn : matched.labelKo) : key;
}

function buildInitialPublishAt() {
  return "2026-04-01T09:00";
}

function stringOf(value: unknown) {
  return typeof value === "string" ? value : "";
}

function stringArrayOf(value: unknown) {
  return Array.isArray(value) ? value.map((item) => String(item)).filter(Boolean) : [];
}

function booleanOf(value: unknown) {
  return value === true || String(value).toLowerCase() === "true";
}

function buildBoardListHref(boardId: string) {
  return buildLocalizedPath(
    `/admin/content/board_list${boardId ? `?selectedBoardId=${encodeURIComponent(boardId)}` : ""}`,
    `/en/admin/content/board_list${boardId ? `?selectedBoardId=${encodeURIComponent(boardId)}` : ""}`
  );
}

function buildPostListHref(postId: string) {
  return buildLocalizedPath(
    `/admin/content/post_list${postId ? `?selectedPostId=${encodeURIComponent(postId)}` : ""}`,
    `/en/admin/content/post_list${postId ? `?selectedPostId=${encodeURIComponent(postId)}` : ""}`
  );
}

function readContextFromLocation() {
  const search = new URLSearchParams(window.location.search);
  return {
    draftId: search.get("draftId") || "",
    selectedBoardId: search.get("selectedBoardId") || "",
    linkedPostId: search.get("linkedPostId") || ""
  };
}

export function BoardAddMigrationPage() {
  const en = isEnglish();
  const initialContext = readContextFromLocation();
  const [draftId, setDraftId] = useState(initialContext.draftId);
  const [selectedBoardId, setSelectedBoardId] = useState(initialContext.selectedBoardId);
  const [boardType, setBoardType] = useState("NOTICE");
  const [audience, setAudience] = useState<AudienceKey>("ALL");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [body, setBody] = useState("");
  const [publishAt, setPublishAt] = useState(buildInitialPublishAt);
  const [expireAt, setExpireAt] = useState("2026-04-08T18:00");
  const [channels, setChannels] = useState<ChannelKey[]>(["PORTAL", "EMAIL"]);
  const [tags, setTags] = useState<string[]>(["정책안내"]);
  const [pinned, setPinned] = useState(true);
  const [urgent, setUrgent] = useState(false);
  const [allowComments, setAllowComments] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const pageState = useAsyncValue<BoardDistributionPagePayload>(
    () => fetchBoardDistributionPage(),
    [],
    {
      onSuccess(payload) {
        const detail = (payload.draftDetail || {}) as Record<string, unknown>;
        const resolvedDraftId = stringOf(payload.draftId) || stringOf(detail.draftId) || initialContext.draftId;
        setDraftId(resolvedDraftId);
        setSelectedBoardId(resolvedDraftId || initialContext.selectedBoardId);
        setBoardType(stringOf(detail.boardType) || "NOTICE");
        setAudience((stringOf(detail.audience) || "ALL") as AudienceKey);
        setTitle(stringOf(detail.title));
        setSummary(stringOf(detail.summary));
        setBody(stringOf(detail.body));
        setPublishAt(stringOf(detail.publishAt) || buildInitialPublishAt());
        setExpireAt(stringOf(detail.expireAt) || "2026-04-08T18:00");
        setChannels((stringArrayOf(detail.channels) as ChannelKey[]).length ? (stringArrayOf(detail.channels) as ChannelKey[]) : ["PORTAL", "EMAIL"]);
        setTags(stringArrayOf(detail.tags).length ? stringArrayOf(detail.tags) : ["정책안내"]);
        setPinned(booleanOf(detail.pinned));
        setUrgent(booleanOf(detail.urgent));
        setAllowComments(booleanOf(detail.allowComments));
      }
    }
  );

  const recipientEstimate = useMemo(
    () => formatRecipientEstimate(audience, urgent),
    [audience, urgent]
  );
  const summaryCards = ((pageState.value?.summaryCards || []) as Array<Record<string, string>>);
  const governanceNotes = ((pageState.value?.governanceNotes || []) as Array<Record<string, string>>);
  const linkedPostId = stringOf((pageState.value?.draftDetail || {})["linkedPostId"]) || initialContext.linkedPostId;
  const previewTitle = title.trim() || (en ? "Notice title preview" : "공지 제목 미리보기");
  const previewSummary = summary.trim() || (en ? "A short summary for list exposure appears here." : "목록 노출용 요약 문구가 여기에 표시됩니다.");
  const previewBody = body.trim() || (en ? "Detailed notice body is shown in this panel before publishing." : "배포 전 상세 본문이 이 패널에 표시됩니다.");

  useEffect(() => {
    logGovernanceScope("PAGE", "board-add", {
      route: window.location.pathname,
      language: en ? "en" : "ko",
      boardType,
      audience,
      channels: channels.join(","),
      pinned,
      urgent
    });
  }, [audience, boardType, channels, en, pinned, urgent]);

  useEffect(() => {
    const nextSearch = new URLSearchParams();
    const resolvedDraftId = draftId || selectedBoardId;
    if (resolvedDraftId) {
      nextSearch.set("draftId", resolvedDraftId);
      nextSearch.set("selectedBoardId", resolvedDraftId);
    }
    if (linkedPostId) {
      nextSearch.set("linkedPostId", linkedPostId);
    }
    const nextQuery = nextSearch.toString();
    const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}${window.location.hash || ""}`;
    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash || ""}`;
    if (nextUrl !== currentUrl) {
      window.history.replaceState({}, "", nextUrl);
    }
  }, [draftId, linkedPostId, selectedBoardId]);

  function toggleChannel(channel: ChannelKey) {
    setChannels((current) => (
      current.includes(channel)
        ? current.filter((item) => item !== channel)
        : [...current, channel]
    ));
  }

  function toggleTag(tag: string) {
    setTags((current) => (
      current.includes(tag)
        ? current.filter((item) => item !== tag)
        : [...current, tag]
    ));
  }

  function resetForm() {
    setBoardType("NOTICE");
    setAudience("ALL");
    setTitle("");
    setSummary("");
    setBody("");
    setPublishAt(buildInitialPublishAt());
    setExpireAt("2026-04-08T18:00");
    setChannels(["PORTAL", "EMAIL"]);
    setTags(["정책안내"]);
    setPinned(true);
    setUrgent(false);
    setAllowComments(false);
    setMessage("");
    setError("");
  }

  function validateForm() {
    if (!title.trim()) {
      return en ? "Enter a notice title." : "공지 제목을 입력하세요.";
    }
    if (!summary.trim()) {
      return en ? "Enter a summary for list exposure." : "목록 노출용 요약을 입력하세요.";
    }
    if (!body.trim()) {
      return en ? "Enter the notice body." : "공지 본문을 입력하세요.";
    }
    if (!channels.length) {
      return en ? "Select at least one delivery channel." : "최소 한 개 이상의 배포 채널을 선택하세요.";
    }
    return "";
  }

  function handleSaveDraft() {
    void (async () => {
      const nextError = validateForm();
      setError(nextError);
      setMessage("");
      if (nextError) {
        return;
      }
      try {
        const response = await saveBoardDistributionPage({
          draftId,
          boardType,
          audience,
          title,
          summary,
          body,
          publishAt,
          expireAt,
          channels,
          tags,
          pinned,
          urgent,
          allowComments
        });
        const nextDraftId = stringOf(response.draftId) || draftId;
        setDraftId(nextDraftId);
        setSelectedBoardId(nextDraftId);
        setMessage(stringOf(response.message) || (en ? "Draft saved for notice distribution review." : "공지 배포 초안을 검토 상태로 저장했습니다."));
        setError("");
        await pageState.reload();
      } catch (saveError) {
        setError(saveError instanceof Error ? saveError.message : (en ? "Failed to save notice distribution draft." : "공지 배포 초안 저장에 실패했습니다."));
      }
    })();
  }

  function handlePublish() {
    void (async () => {
      const nextError = validateForm();
      setError(nextError);
      setMessage("");
      if (nextError) {
        return;
      }
      try {
        const response = await saveBoardDistributionPage({
          draftId,
          boardType,
          audience,
          title,
          summary,
          body,
          publishAt,
          expireAt,
          channels,
          tags,
          pinned,
          urgent,
          allowComments
        });
        const nextDraftId = stringOf(response.draftId) || draftId;
        const nextLinkedPostId = stringOf((response.draftDetail || {})["linkedPostId"]) || linkedPostId;
        setDraftId(nextDraftId);
        setSelectedBoardId(nextDraftId);
        setMessage(stringOf(response.message) || (en ? "Notice distribution queue has been prepared." : "공지 배포 큐를 준비했습니다."));
        setError("");
        await pageState.reload();
        navigate(buildPostListHref(nextLinkedPostId));
      } catch (saveError) {
        setError(saveError instanceof Error ? saveError.message : (en ? "Failed to prepare notice distribution queue." : "공지 배포 등록에 실패했습니다."));
      }
    })();
  }

  return (
    <AdminPageShell
      breadcrumbs={[
        { label: en ? "Home" : "홈", href: buildLocalizedPath("/admin/", "/en/admin/") },
        { label: en ? "Content" : "콘텐츠" },
        { label: en ? "Board Management" : "게시판 관리", href: buildLocalizedPath("/admin/content/board_list", "/en/admin/content/board_list") },
        { label: en ? "Notice Distribution" : "공지 배포" }
      ]}
      title={en ? "Notice Distribution" : "공지 배포"}
      subtitle={en ? "Compose notice content, audience, and delivery channels before releasing it to operators and members." : "공지 내용, 대상, 배포 채널을 한 화면에서 조합한 뒤 운영 배포로 넘깁니다."}
      loading={pageState.loading}
      loadingLabel={en ? "Loading notice distribution draft." : "공지 배포 초안을 불러오는 중입니다."}
    >
      <AdminWorkspacePageFrame>
        {message ? <PageStatusNotice tone="success">{message}</PageStatusNotice> : null}
        {error ? <PageStatusNotice tone="error">{error}</PageStatusNotice> : null}
        {pageState.error ? <PageStatusNotice tone="error">{pageState.error}</PageStatusNotice> : null}

        <CollectionResultPanel
          data-help-id="board-add-scope"
          icon="campaign"
          title={en ? "Distribution Scope" : "배포 범위"}
          description={en ? "This screen is for first-pass notice setup and operator review, keeping the shared admin create-page layout." : "이 화면은 공지 초안 작성과 운영 검토 준비를 위한 단계이며, 공통 관리자 등록형 레이아웃을 따릅니다."}
        >
          {en ? "Audience, urgency, and delivery channel selection are grouped first so the release impact is visible before content editing." : "대상, 긴급도, 채널을 먼저 묶어 배포 영향도를 본문 작성 전에 확인할 수 있게 구성했습니다."}
        </CollectionResultPanel>

        <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          {(summaryCards.length ? summaryCards : [
            {
              title: en ? "Recipient Estimate" : "예상 수신자",
              value: recipientEstimate.toLocaleString("en-US"),
              description: en ? "Current audience and urgency based estimate" : "현재 대상과 긴급도 기준 추정치"
            },
            {
              title: en ? "Channels" : "배포 채널",
              value: String(channels.length),
              description: channels.map((channel) => channelLabel(en, channel)).join(", ")
            }
          ]).map((card) => (
            <SummaryMetricCard
              key={`${card.title}-${card.value}`}
              title={stringOf(card.title)}
              value={stringOf(card.value)}
              description={stringOf(card.description)}
            />
          ))}
        </section>

        <LookupContextStrip
          label={en ? "Current Release Context" : "현재 배포 컨텍스트"}
          value={(
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold">{audienceLabel(en, audience)}</span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-700">{boardType}</span>
              {urgent ? <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">{en ? "Urgent" : "긴급"}</span> : null}
              {pinned ? <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-700">{en ? "Pinned" : "상단 고정"}</span> : null}
            </div>
          )}
          action={(
            <div className="flex flex-wrap gap-2">
              <MemberLinkButton
                href={buildBoardListHref(draftId || selectedBoardId)}
                size="xs"
                variant="secondary"
              >
                {en ? "Open Board List" : "게시판 목록"}
              </MemberLinkButton>
              <MemberLinkButton
                href={buildPostListHref(linkedPostId)}
                size="xs"
                variant="primary"
              >
                {en ? "Open Post List" : "게시글 목록"}
              </MemberLinkButton>
              <MemberButton size="xs" type="button" variant="secondary" onClick={resetForm}>
                {en ? "Reset" : "초기화"}
              </MemberButton>
            </div>
          )}
        />

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.9fr)]">
          <section className="gov-card" data-help-id="board-add-form">
            <MemberSectionToolbar
              title={en ? "Notice Compose Form" : "공지 작성 폼"}
              meta={en ? "Shared create-screen spacing and bottom actions are kept aligned with banner/popup edit pages." : "배너/팝업 편집과 같은 공통 등록형 간격과 하단 액션 패턴을 유지합니다."}
            />

            <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-[14px] font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Board Type" : "게시 유형"}</label>
                <AdminSelect value={boardType} onChange={(event) => setBoardType(event.target.value)}>
                  <option value="NOTICE">{en ? "General Notice" : "일반 공지"}</option>
                  <option value="POLICY">{en ? "Policy Update" : "정책 안내"}</option>
                  <option value="MAINTENANCE">{en ? "Maintenance Alert" : "점검 공지"}</option>
                </AdminSelect>
              </div>
              <div>
                <label className="mb-2 block text-[14px] font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Audience" : "대상 그룹"}</label>
                <AdminSelect value={audience} onChange={(event) => setAudience(event.target.value as AudienceKey)}>
                  {AUDIENCE_OPTIONS.map((option) => (
                    <option key={option.key} value={option.key}>{en ? option.labelEn : option.labelKo}</option>
                  ))}
                </AdminSelect>
              </div>
              <div className="md:col-span-2">
                <label className="mb-2 block text-[14px] font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Notice Title" : "공지 제목"}</label>
                <AdminInput value={title} onChange={(event) => setTitle(event.target.value)} />
              </div>
              <div className="md:col-span-2">
                <label className="mb-2 block text-[14px] font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Summary" : "요약 문구"}</label>
                <AdminInput value={summary} onChange={(event) => setSummary(event.target.value)} />
              </div>
              <div>
                <label className="mb-2 block text-[14px] font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Publish At" : "배포 시작"}</label>
                <AdminInput type="datetime-local" value={publishAt} onChange={(event) => setPublishAt(event.target.value)} />
              </div>
              <div>
                <label className="mb-2 block text-[14px] font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Expire At" : "배포 종료"}</label>
                <AdminInput type="datetime-local" value={expireAt} onChange={(event) => setExpireAt(event.target.value)} />
              </div>
              <div className="md:col-span-2">
                <label className="mb-3 block text-[14px] font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Delivery Channels" : "배포 채널"}</label>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  {CHANNEL_OPTIONS.map((option) => (
                    <label key={option.key} className="flex items-center gap-3 rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] px-4 py-3">
                      <AdminCheckbox checked={channels.includes(option.key)} className="h-4 w-4 border-gray-300" onChange={() => toggleChannel(option.key)} />
                      <span className="text-sm font-bold text-[var(--kr-gov-text-primary)]">{en ? option.labelEn : option.labelKo}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="md:col-span-2">
                <label className="mb-3 block text-[14px] font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Topic Tags" : "주제 태그"}</label>
                <div className="flex flex-wrap gap-2">
                  {TAG_OPTIONS.map((tag) => (
                    <button
                      key={tag}
                      className={`rounded-full border px-3 py-1.5 text-xs font-bold ${tags.includes(tag) ? "border-[var(--kr-gov-blue)] bg-[rgba(33,123,214,0.08)] text-[var(--kr-gov-blue)]" : "border-[var(--kr-gov-border-light)] bg-white text-slate-700"}`}
                      onClick={() => toggleTag(tag)}
                      type="button"
                    >
                      #{tag}
                    </button>
                  ))}
                </div>
              </div>
              <div className="md:col-span-2">
                <label className="mb-2 block text-[14px] font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Notice Body" : "공지 본문"}</label>
                <AdminTextarea rows={10} value={body} onChange={(event) => setBody(event.target.value)} />
              </div>
            </div>

            <section className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-3" data-help-id="board-add-options">
              <label className="flex items-center gap-3 rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] px-4 py-3">
                <AdminCheckbox checked={pinned} className="h-4 w-4 border-gray-300" onChange={(event) => setPinned(event.target.checked)} />
                <div>
                  <p className="text-sm font-bold text-[var(--kr-gov-text-primary)]">{en ? "Pin to top" : "상단 고정"}</p>
                  <p className="text-xs text-[var(--kr-gov-text-secondary)]">{en ? "Expose above standard board posts" : "일반 게시글보다 상단에 노출"}</p>
                </div>
              </label>
              <label className="flex items-center gap-3 rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] px-4 py-3">
                <AdminCheckbox checked={urgent} className="h-4 w-4 border-gray-300" onChange={(event) => setUrgent(event.target.checked)} />
                <div>
                  <p className="text-sm font-bold text-[var(--kr-gov-text-primary)]">{en ? "Urgent delivery" : "긴급 배포"}</p>
                  <p className="text-xs text-[var(--kr-gov-text-secondary)]">{en ? "Highlights queue and expands notification scope" : "알림 우선순위를 높이고 대상 범위를 넓힘"}</p>
                </div>
              </label>
              <label className="flex items-center gap-3 rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] px-4 py-3">
                <AdminCheckbox checked={allowComments} className="h-4 w-4 border-gray-300" onChange={(event) => setAllowComments(event.target.checked)} />
                <div>
                  <p className="text-sm font-bold text-[var(--kr-gov-text-primary)]">{en ? "Allow replies" : "댓글 허용"}</p>
                  <p className="text-xs text-[var(--kr-gov-text-secondary)]">{en ? "Member comments remain open after release" : "배포 후 사용자 댓글 입력 허용"}</p>
                </div>
              </label>
            </section>

            <div className="mt-6 flex flex-wrap justify-end gap-2 border-t border-[var(--kr-gov-border-light)] pt-5">
              <MemberButton type="button" variant="secondary" onClick={handleSaveDraft}>
                {en ? "Save Draft" : "임시 저장"}
              </MemberButton>
              <MemberButton type="button" variant="primary" onClick={handlePublish}>
                {en ? "Queue Distribution" : "배포 등록"}
              </MemberButton>
            </div>
          </section>

          <section className="space-y-6" data-help-id="board-add-preview">
            <article className="gov-card">
              <MemberSectionToolbar title={en ? "Release Preview" : "배포 미리보기"} />
              <div className="mt-5 rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-[linear-gradient(180deg,rgba(33,123,214,0.08),rgba(255,255,255,0.98))] p-5">
                <div className="flex flex-wrap items-center gap-2">
                  {tags.map((tag) => (
                    <span key={tag} className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-[var(--kr-gov-blue)] shadow-sm">#{tag}</span>
                  ))}
                </div>
                <h3 className="mt-4 text-xl font-black text-[var(--kr-gov-text-primary)]">{previewTitle}</h3>
                <p className="mt-2 text-sm font-medium text-[var(--kr-gov-text-secondary)]">{previewSummary}</p>
                <div className="mt-4 whitespace-pre-wrap rounded-[var(--kr-gov-radius)] bg-white/80 p-4 text-sm leading-6 text-[var(--kr-gov-text-primary)]">
                  {previewBody}
                </div>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                <SummaryMetricCard title={en ? "Audience" : "배포 대상"} value={audienceLabel(en, audience)} />
                <SummaryMetricCard title={en ? "Schedule" : "배포 일정"} value={`${publishAt} ~ ${expireAt}`} />
              </div>
            </article>

            <article className="gov-card" data-help-id="board-add-audience">
              <MemberSectionToolbar title={en ? "Delivery Checklist" : "배포 체크리스트"} />
              <ul className="mt-5 space-y-3 text-sm text-[var(--kr-gov-text-primary)]">
                <li className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] px-4 py-3">
                  {en ? `Estimated recipients: ${recipientEstimate.toLocaleString("en-US")} users` : `예상 수신자: ${recipientEstimate.toLocaleString("ko-KR")}명`}
                </li>
                <li className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] px-4 py-3">
                  {en ? `Delivery channels: ${channels.map((channel) => channelLabel(en, channel)).join(", ")}` : `배포 채널: ${channels.map((channel) => channelLabel(en, channel)).join(", ")}`}
                </li>
                <li className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] px-4 py-3">
                  {en ? `Comments: ${allowComments ? "allowed" : "blocked"} / Top exposure: ${pinned ? "enabled" : "disabled"}` : `댓글: ${allowComments ? "허용" : "차단"} / 상단 고정: ${pinned ? "사용" : "미사용"}`}
                </li>
                {governanceNotes.map((note) => (
                  <li key={stringOf(note.title)} className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] px-4 py-3">
                    <p className="font-bold">{stringOf(note.title)}</p>
                    <p className="mt-1 text-[var(--kr-gov-text-secondary)]">{stringOf(note.body)}</p>
                  </li>
                ))}
              </ul>
            </article>
          </section>
        </section>
      </AdminWorkspacePageFrame>
    </AdminPageShell>
  );
}
