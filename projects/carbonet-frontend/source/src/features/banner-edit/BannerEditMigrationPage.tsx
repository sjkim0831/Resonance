import { useEffect, useState } from "react";
import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { logGovernanceScope } from "../../app/policy/debug";
import { fetchBannerEditPage, saveBannerEditPage } from "../../lib/api/content";
import type { BannerEditPagePayload } from "../../lib/api/contentTypes";
import { buildLocalizedPath, isEnglish } from "../../lib/navigation/runtime";
import { AdminPageShell } from "../admin-entry/AdminPageShell";
import { CollectionResultPanel, PageStatusNotice, SummaryMetricCard } from "../admin-ui/common";
import { AdminWorkspacePageFrame } from "../admin-ui/pageFrames";
import { AdminInput, AdminSelect, MemberButton, MemberSectionToolbar } from "../member/common";

function readBannerId() {
  return new URLSearchParams(window.location.search).get("bannerId") || "BNR-240301";
}

function stringOf(value: unknown) {
  return typeof value === "string" ? value : "";
}

export function BannerEditMigrationPage() {
  const en = isEnglish();
  const [bannerId] = useState(readBannerId());
  const [title, setTitle] = useState("");
  const [targetUrl, setTargetUrl] = useState("");
  const [status, setStatus] = useState("LIVE");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [message, setMessage] = useState("");
  const pageState = useAsyncValue<BannerEditPagePayload>(
    () => fetchBannerEditPage(bannerId),
    [bannerId],
    {
      onSuccess(payload) {
        const detail = (payload.bannerDetail || {}) as Record<string, unknown>;
        setTitle(stringOf(detail.title));
        setTargetUrl(stringOf(detail.targetUrl));
        setStatus(stringOf(detail.status) || "LIVE");
        setStartAt(stringOf(detail.startAt));
        setEndAt(stringOf(detail.endAt));
      }
    }
  );
  const detail = ((pageState.value?.bannerDetail || {}) as Record<string, unknown>);
  const statusOptions = ((pageState.value?.statusOptions || []) as Array<Record<string, string>>);
  const summaryCards = ((pageState.value?.summaryCards || []) as Array<Record<string, string>>);

  useEffect(() => {
    if (!pageState.value) {
      return;
    }
    logGovernanceScope("PAGE", "banner-edit", {
      route: window.location.pathname,
      bannerId,
      status
    });
  }, [bannerId, pageState.value, status]);

  return (
    <AdminPageShell
      breadcrumbs={[
        { label: en ? "Home" : "홈", href: buildLocalizedPath("/admin/", "/en/admin/") },
        { label: en ? "Content" : "콘텐츠" },
        { label: en ? "Banner List" : "배너 목록", href: buildLocalizedPath("/admin/content/banner_list", "/en/admin/content/banner_list") },
        { label: en ? "Banner Edit" : "배너 편집" }
      ]}
      title={en ? "Banner Edit" : "배너 편집"}
      subtitle={en ? "Edit the selected banner metadata and schedule." : "선택한 배너의 문구와 일정, 연결 정보를 조정합니다."}
      loading={pageState.loading}
      loadingLabel={en ? "Loading banner detail." : "배너 상세를 불러오는 중입니다."}
    >
      <AdminWorkspacePageFrame>
        {message ? <PageStatusNotice tone="success">{message}</PageStatusNotice> : null}
        {pageState.error ? <PageStatusNotice tone="error">{pageState.error}</PageStatusNotice> : null}
        <CollectionResultPanel
          data-help-id="banner-edit-scope"
          icon="edit_square"
          title={en ? "Edit Scope" : "편집 범위"}
          description={en ? "This screen is the next step from Banner List and now reads core banner fields from the backend mapper." : "이 화면은 배너 목록 다음 단계이며 이제 백엔드 매퍼를 통해 배너 기본 정보를 조회하고 저장합니다."}
        >
          {en ? "Core fields are persisted through COMTNBANNER, while unsupported schedule metadata stays on the current runtime overlay." : "기본 필드는 COMTNBANNER에 저장되고, 현재 스키마에 없는 일정 메타데이터는 런타임 overlay로 유지됩니다."}
        </CollectionResultPanel>
        <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4" data-help-id="banner-edit-summary">
          {summaryCards.map((card) => (
            <SummaryMetricCard
              key={`${card.title}-${card.value}`}
              title={stringOf(card.title)}
              value={stringOf(card.value)}
              description={stringOf(card.description)}
            />
          ))}
        </section>
        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,1fr)]">
          <section className="gov-card" data-help-id="banner-edit-form">
            <MemberSectionToolbar meta={bannerId} title={en ? "Banner Form" : "배너 편집 폼"} />
            <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="mb-2 block text-[14px] font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Banner Title" : "배너명"}</label>
                <AdminInput value={title} onChange={(event) => setTitle(event.target.value)} />
              </div>
              <div className="md:col-span-2">
                <label className="mb-2 block text-[14px] font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Target URL" : "연결 URL"}</label>
                <AdminInput value={targetUrl} onChange={(event) => setTargetUrl(event.target.value)} />
              </div>
              <div>
                <label className="mb-2 block text-[14px] font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Status" : "상태"}</label>
                <AdminSelect value={status} onChange={(event) => setStatus(event.target.value)}>
                  {statusOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </AdminSelect>
              </div>
              <div>
                <label className="mb-2 block text-[14px] font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Placement" : "노출 영역"}</label>
                <AdminInput value={stringOf(detail.placement)} disabled />
              </div>
              <div>
                <label className="mb-2 block text-[14px] font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Start At" : "시작일시"}</label>
                <AdminInput value={startAt} onChange={(event) => setStartAt(event.target.value)} />
              </div>
              <div>
                <label className="mb-2 block text-[14px] font-bold text-[var(--kr-gov-text-secondary)]">{en ? "End At" : "종료일시"}</label>
                <AdminInput value={endAt} onChange={(event) => setEndAt(event.target.value)} />
              </div>
            </div>
            <div className="mt-6 flex flex-wrap justify-end gap-2 border-t border-[var(--kr-gov-border-light)] pt-5" data-help-id="banner-edit-actions">
              <a
                className="inline-flex items-center rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] px-4 py-2 text-sm font-bold"
                href={buildLocalizedPath("/admin/content/banner_list", "/en/admin/content/banner_list")}
              >
                {en ? "Back to List" : "목록으로"}
              </a>
              <MemberButton
                type="button"
                variant="primary"
                onClick={async () => {
                  const response = await saveBannerEditPage({
                    bannerId,
                    title,
                    targetUrl,
                    status,
                    startAt,
                    endAt
                  });
                  setMessage(stringOf(response.message));
                  await pageState.reload();
                }}
              >
                {en ? "Save Draft" : "임시 저장"}
              </MemberButton>
            </div>
          </section>
          <section className="space-y-6" data-help-id="banner-edit-preview">
            <article className="gov-card">
              <MemberSectionToolbar title={en ? "Preview" : "미리보기"} />
              <div className="mt-5 rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-[linear-gradient(135deg,rgba(33,123,214,0.1),rgba(255,255,255,0.98))] p-5">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--kr-gov-blue)]">{bannerId}</p>
                <h3 className="mt-2 text-xl font-black text-[var(--kr-gov-text-primary)]">{title}</h3>
                <p className="mt-3 break-all text-sm leading-6 text-[var(--kr-gov-text-secondary)]">{targetUrl}</p>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                <SummaryMetricCard title={en ? "Status" : "상태"} value={status} />
                <SummaryMetricCard title={en ? "Schedule" : "일정"} value={`${startAt} ~ ${endAt}`} />
              </div>
            </article>
          </section>
        </section>
      </AdminWorkspacePageFrame>
    </AdminPageShell>
  );
}
