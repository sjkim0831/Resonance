import { FormEvent, type HTMLAttributes, type ReactNode, useEffect, useMemo, useState } from "react";
import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { logGovernanceScope } from "../../app/policy/debug";
import { fetchPopupEditPage, savePopupEditPage } from "../../lib/api/content";
import type { PopupEditPagePayload } from "../../lib/api/contentTypes";
import { buildLocalizedPath, isEnglish, navigate } from "../../lib/navigation/runtime";
import { AdminPageShell } from "../admin-entry/AdminPageShell";
import { SummaryMetricCard } from "../admin-ui/common";
import { AdminEditPageFrame } from "../admin-ui/pageFrames";
import { AdminInput, AdminSelect, AdminTextarea, MemberActionBar, MemberButton, PageStatusNotice, getMemberButtonClassName } from "../member/common";

type PopupFormState = {
  popupId: string;
  popupTitle: string;
  popupType: string;
  exposureStatus: string;
  priority: string;
  useAt: string;
  targetAudience: string;
  displayScope: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  closePolicy: string;
  width: string;
  height: string;
  headline: string;
  body: string;
  ctaLabel: string;
  ctaUrl: string;
  ownerName: string;
  ownerContact: string;
  notes: string;
};

function SectionCard({ title, description, children, ...props }: { title: string; description: string; children: ReactNode } & HTMLAttributes<HTMLElement>) {
  return (
    <section {...props} className={`overflow-hidden rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white shadow-sm ${props.className || ""}`.trim()}>
      <div className="border-b border-[var(--kr-gov-border-light)] bg-slate-50 px-6 py-5">
        <h2 className="text-base font-black text-[var(--kr-gov-text-primary)]">{title}</h2>
        <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">{description}</p>
      </div>
      <div className="p-6">{children}</div>
    </section>
  );
}

function Field({ label, required = false, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-sm font-bold text-[var(--kr-gov-text-primary)]">
        {label}
        {required ? <span className="ml-1 text-red-600">*</span> : null}
      </span>
      {children}
    </label>
  );
}

function buildInitialForm(en: boolean): PopupFormState {
  const search = new URLSearchParams(window.location.search);
  return {
    popupId: search.get("popupId") || "POPUP-2026-031",
    popupTitle: search.get("popupTitle") || (en ? "Quarterly operator notice" : "분기 운영 공지 팝업"),
    popupType: search.get("popupType") || "NOTICE",
    exposureStatus: search.get("exposureStatus") || "SCHEDULED",
    priority: search.get("priority") || "HIGH",
    useAt: search.get("useAt") || "Y",
    targetAudience: search.get("targetAudience") || "ADMIN",
    displayScope: search.get("displayScope") || "ALL_ADMIN",
    startDate: search.get("startDate") || "2026-04-01",
    startTime: search.get("startTime") || "09:00",
    endDate: search.get("endDate") || "2026-04-15",
    endTime: search.get("endTime") || "18:00",
    closePolicy: search.get("closePolicy") || "ONE_DAY",
    width: search.get("width") || "720",
    height: search.get("height") || "560",
    headline: search.get("headline") || (en ? "Platform maintenance and policy updates" : "플랫폼 점검 및 정책 변경 안내"),
    body: search.get("body") || (en
      ? "Show this popup to administrators before scheduled maintenance. Include policy updates, downtime impact, and a contact point for urgent questions."
      : "정기 점검 전에 관리자에게 노출할 팝업입니다. 정책 변경 사항, 예상 중단 영향, 긴급 문의 채널을 함께 안내합니다."),
    ctaLabel: search.get("ctaLabel") || (en ? "Open details" : "상세 공지 보기"),
    ctaUrl: search.get("ctaUrl") || "/admin/system/notification",
    ownerName: search.get("ownerName") || (en ? "Content Operations Team" : "콘텐츠 운영팀"),
    ownerContact: search.get("ownerContact") || "popup-ops@carbonet.local",
    notes: search.get("notes") || (en ? "Review linked notice content before activation." : "활성화 전에 연결 공지 내용을 최종 검토하세요.")
  };
}

function stringOf(value: unknown) {
  return typeof value === "string" ? value : "";
}

function readPopupId(en: boolean) {
  return new URLSearchParams(window.location.search).get("popupId") || buildInitialForm(en).popupId;
}

function normalizePopupForm(detail: Record<string, unknown>, fallback: PopupFormState): PopupFormState {
  return {
    popupId: stringOf(detail.popupId) || fallback.popupId,
    popupTitle: stringOf(detail.popupTitle) || fallback.popupTitle,
    popupType: stringOf(detail.popupType) || fallback.popupType,
    exposureStatus: stringOf(detail.exposureStatus) || fallback.exposureStatus,
    priority: stringOf(detail.priority) || fallback.priority,
    useAt: stringOf(detail.useAt) || fallback.useAt,
    targetAudience: stringOf(detail.targetAudience) || fallback.targetAudience,
    displayScope: stringOf(detail.displayScope) || fallback.displayScope,
    startDate: stringOf(detail.startDate) || fallback.startDate,
    startTime: stringOf(detail.startTime) || fallback.startTime,
    endDate: stringOf(detail.endDate) || fallback.endDate,
    endTime: stringOf(detail.endTime) || fallback.endTime,
    closePolicy: stringOf(detail.closePolicy) || fallback.closePolicy,
    width: stringOf(detail.width) || fallback.width,
    height: stringOf(detail.height) || fallback.height,
    headline: stringOf(detail.headline) || fallback.headline,
    body: stringOf(detail.body) || fallback.body,
    ctaLabel: stringOf(detail.ctaLabel) || fallback.ctaLabel,
    ctaUrl: stringOf(detail.ctaUrl) || fallback.ctaUrl,
    ownerName: stringOf(detail.ownerName) || fallback.ownerName,
    ownerContact: stringOf(detail.ownerContact) || fallback.ownerContact,
    notes: stringOf(detail.notes) || fallback.notes
  };
}

function formatDateTime(date: string, time: string) {
  return date && time ? `${date} ${time}` : "-";
}

export function PopupEditMigrationPage() {
  const en = isEnglish();
  const [popupId] = useState(() => readPopupId(en));
  const fallbackForm = useMemo(() => buildInitialForm(en), [en]);
  const [loadedForm, setLoadedForm] = useState<PopupFormState>(fallbackForm);
  const [form, setForm] = useState<PopupFormState>(fallbackForm);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const pageState = useAsyncValue<PopupEditPagePayload>(
    () => fetchPopupEditPage(popupId),
    [popupId],
    {
      onSuccess(payload) {
        const nextForm = normalizePopupForm((payload.popupDetail || {}) as Record<string, unknown>, fallbackForm);
        setLoadedForm(nextForm);
        setForm(nextForm);
      }
    }
  );
  const summaryCards = ((pageState.value?.summaryCards || []) as Array<Record<string, string>>);
  const popupTypeOptions = ((pageState.value?.popupTypeOptions || []) as Array<Record<string, string>>);
  const priorityOptions = ((pageState.value?.priorityOptions || []) as Array<Record<string, string>>);
  const exposureStatusOptions = ((pageState.value?.exposureStatusOptions || []) as Array<Record<string, string>>);
  const useAtOptions = ((pageState.value?.useAtOptions || []) as Array<Record<string, string>>);
  const targetAudienceOptions = ((pageState.value?.targetAudienceOptions || []) as Array<Record<string, string>>);
  const displayScopeOptions = ((pageState.value?.displayScopeOptions || []) as Array<Record<string, string>>);
  const closePolicyOptions = ((pageState.value?.closePolicyOptions || []) as Array<Record<string, string>>);

  useEffect(() => {
    if (!pageState.value) {
      return;
    }
    logGovernanceScope("PAGE", "popup-edit", {
      route: window.location.pathname,
      popupId: form.popupId,
      exposureStatus: form.exposureStatus,
      targetAudience: form.targetAudience
    });
  }, [form.exposureStatus, form.popupId, form.targetAudience, pageState.value]);

  const completionRatio = useMemo(() => {
    const requiredFields = [
      form.popupTitle,
      form.startDate,
      form.endDate,
      form.headline,
      form.body,
      form.ownerName,
      form.ownerContact
    ];
    return Math.round((requiredFields.filter((value) => value.trim()).length / requiredFields.length) * 100);
  }, [form]);

  const dirtyCount = useMemo(
    () => Object.keys(form).filter((key) => form[key as keyof PopupFormState] !== loadedForm[key as keyof PopupFormState]).length,
    [form, loadedForm]
  );

  function updateField<K extends keyof PopupFormState>(key: K, value: PopupFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function handleReset() {
    setForm(loadedForm);
    setMessage("");
    setError("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");

    if (!form.popupTitle.trim() || !form.headline.trim()) {
      setError(en ? "Enter both popup title and headline." : "팝업명과 헤드라인을 입력하세요.");
      return;
    }
    if (!form.startDate || !form.endDate) {
      setError(en ? "Enter both exposure start and end dates." : "노출 시작일과 종료일을 입력하세요.");
      return;
    }
    if (`${form.startDate} ${form.startTime}` > `${form.endDate} ${form.endTime}`) {
      setError(en ? "Exposure end must be later than the start." : "노출 종료 시점은 시작 시점보다 뒤여야 합니다.");
      return;
    }
    if (!form.ownerName.trim() || !form.ownerContact.trim()) {
      setError(en ? "Enter the owner and contact for this popup." : "담당 부서와 연락처를 입력하세요.");
      return;
    }

    logGovernanceScope("ACTION", "popup-edit-save", {
      popupId: form.popupId,
      popupType: form.popupType,
      exposureStatus: form.exposureStatus,
      dirtyCount
    });

    try {
      const response = await savePopupEditPage(form);
      setMessage(stringOf(response.message) || (en ? "Popup schedule saved." : "팝업 스케줄을 저장했습니다."));
      await pageState.reload();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : (en ? "Failed to save popup schedule." : "팝업 스케줄 저장에 실패했습니다."));
    }
  }

  return (
    <AdminPageShell
      breadcrumbs={[
        { label: en ? "Home" : "홈", href: buildLocalizedPath("/admin/", "/en/admin/") },
        { label: en ? "Content" : "콘텐츠" },
        { label: en ? "Popup Schedule" : "팝업 스케줄" }
      ]}
      title={en ? "Popup Schedule" : "팝업 스케줄"}
      subtitle={en ? "Manage popup exposure timing, audience scope, and content guidance for the connected notice flow." : "팝업 노출 일정, 대상 범위, 연결 공지 문구를 한 화면에서 관리합니다."}
      loading={pageState.loading}
      loadingLabel={en ? "Loading popup schedule." : "팝업 스케줄을 불러오는 중입니다."}
    >
      <form onSubmit={handleSubmit}>
        <AdminEditPageFrame>
          {message ? <PageStatusNotice tone="success">{message}</PageStatusNotice> : null}
          {pageState.error ? <PageStatusNotice tone="error">{pageState.error}</PageStatusNotice> : null}
          {error ? <PageStatusNotice tone="error">{error}</PageStatusNotice> : null}

          <section className="grid grid-cols-1 gap-4 xl:grid-cols-4" data-help-id="popup-edit-summary">
            <SummaryMetricCard
              title={en ? "Readiness" : "작성 진행률"}
              value={`${completionRatio}%`}
              description={en ? "Required popup fields completed." : "필수 팝업 항목 기준 작성 완료율입니다."}
              accentClassName="text-[var(--kr-gov-blue)]"
              surfaceClassName="bg-[#f8fbff]"
            />
            {summaryCards.map((card) => (
              <SummaryMetricCard
                key={`${card.title}-${card.value}`}
                title={stringOf(card.title)}
                value={stringOf(card.value)}
                description={stringOf(card.description)}
              />
            ))}
            <SummaryMetricCard
              title={en ? "Changed Fields" : "변경 항목 수"}
              value={String(dirtyCount)}
              description={en ? "Fields modified from the loaded baseline." : "초기 로드 기준에서 변경된 입력 항목 수입니다."}
            />
            <SummaryMetricCard
              title={en ? "Exposure Window" : "노출 기간"}
              value={formatDateTime(form.startDate, form.startTime)}
              description={formatDateTime(form.endDate, form.endTime)}
            />
          </section>

          <SectionCard
            data-help-id="popup-edit-basic"
            title={en ? "Popup Overview" : "팝업 기본 정보"}
            description={en ? "Set the identifier, popup class, priority, and active flag used by content operations." : "콘텐츠 운영에서 사용하는 식별자, 팝업 유형, 우선순위, 활성 여부를 설정합니다."}
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Field label={en ? "Popup ID" : "팝업 ID"}>
                <AdminInput readOnly value={form.popupId} />
              </Field>
              <Field label={en ? "Popup Title" : "팝업명"} required>
                <AdminInput value={form.popupTitle} onChange={(event) => updateField("popupTitle", event.target.value)} />
              </Field>
              <Field label={en ? "Popup Type" : "팝업 유형"} required>
                <AdminSelect value={form.popupType} onChange={(event) => updateField("popupType", event.target.value)}>
                  {popupTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </AdminSelect>
              </Field>
              <Field label={en ? "Priority" : "우선순위"}>
                <AdminSelect value={form.priority} onChange={(event) => updateField("priority", event.target.value)}>
                  {priorityOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </AdminSelect>
              </Field>
              <Field label={en ? "Exposure Status" : "노출 상태"}>
                <AdminSelect value={form.exposureStatus} onChange={(event) => updateField("exposureStatus", event.target.value)}>
                  {exposureStatusOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </AdminSelect>
              </Field>
              <Field label={en ? "Use" : "사용 여부"}>
                <AdminSelect value={form.useAt} onChange={(event) => updateField("useAt", event.target.value)}>
                  {useAtOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </AdminSelect>
              </Field>
              <Field label={en ? "Target Audience" : "대상 사용자"}>
                <AdminSelect value={form.targetAudience} onChange={(event) => updateField("targetAudience", event.target.value)}>
                  {targetAudienceOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </AdminSelect>
              </Field>
              <Field label={en ? "Display Scope" : "노출 범위"}>
                <AdminSelect value={form.displayScope} onChange={(event) => updateField("displayScope", event.target.value)}>
                  {displayScopeOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </AdminSelect>
              </Field>
            </div>
          </SectionCard>

          <SectionCard
            data-help-id="popup-edit-schedule"
            title={en ? "Exposure Schedule" : "노출 일정"}
            description={en ? "Define the exposure window and close behavior for this popup." : "이 팝업의 노출 기간과 닫기 동작을 정의합니다."}
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Field label={en ? "Start Date" : "시작일"} required>
                <AdminInput type="date" value={form.startDate} onChange={(event) => updateField("startDate", event.target.value)} />
              </Field>
              <Field label={en ? "Start Time" : "시작시간"}>
                <AdminInput type="time" value={form.startTime} onChange={(event) => updateField("startTime", event.target.value)} />
              </Field>
              <Field label={en ? "End Date" : "종료일"} required>
                <AdminInput type="date" value={form.endDate} onChange={(event) => updateField("endDate", event.target.value)} />
              </Field>
              <Field label={en ? "End Time" : "종료시간"}>
                <AdminInput type="time" value={form.endTime} onChange={(event) => updateField("endTime", event.target.value)} />
              </Field>
              <Field label={en ? "Close Policy" : "닫기 정책"}>
                <AdminSelect value={form.closePolicy} onChange={(event) => updateField("closePolicy", event.target.value)}>
                  {closePolicyOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </AdminSelect>
              </Field>
              <Field label={en ? "Width" : "가로 크기"}>
                <AdminInput value={form.width} onChange={(event) => updateField("width", event.target.value)} />
              </Field>
              <Field label={en ? "Height" : "세로 크기"}>
                <AdminInput value={form.height} onChange={(event) => updateField("height", event.target.value)} />
              </Field>
            </div>
          </SectionCard>

          <SectionCard
            data-help-id="popup-edit-content"
            title={en ? "Popup Content" : "팝업 내용"}
            description={en ? "Edit the headline, body copy, and CTA used inside the popup surface." : "팝업 내부에 노출되는 제목, 본문, CTA를 수정합니다."}
          >
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <Field label={en ? "Headline" : "헤드라인"} required>
                <AdminInput value={form.headline} onChange={(event) => updateField("headline", event.target.value)} />
              </Field>
              <Field label={en ? "CTA Label" : "버튼 문구"}>
                <AdminInput value={form.ctaLabel} onChange={(event) => updateField("ctaLabel", event.target.value)} />
              </Field>
              <Field label={en ? "CTA URL" : "버튼 URL"}>
                <AdminInput value={form.ctaUrl} onChange={(event) => updateField("ctaUrl", event.target.value)} />
              </Field>
              <Field label={en ? "Owner Team" : "담당 부서"} required>
                <AdminInput value={form.ownerName} onChange={(event) => updateField("ownerName", event.target.value)} />
              </Field>
              <Field label={en ? "Owner Contact" : "담당 연락처"} required>
                <AdminInput value={form.ownerContact} onChange={(event) => updateField("ownerContact", event.target.value)} />
              </Field>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
              <Field label={en ? "Body" : "본문"} required>
                <AdminTextarea rows={7} value={form.body} onChange={(event) => updateField("body", event.target.value)} />
              </Field>
              <Field label={en ? "Operator Notes" : "운영 메모"}>
                <AdminTextarea rows={7} value={form.notes} onChange={(event) => updateField("notes", event.target.value)} />
              </Field>
            </div>
          </SectionCard>

          <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <article className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-50 p-5 shadow-sm">
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[var(--kr-gov-blue)]">{en ? "Preview Summary" : "미리보기 요약"}</p>
              <h3 className="mt-3 text-xl font-black text-[var(--kr-gov-text-primary)]">{form.headline || "-"}</h3>
              <p className="mt-3 text-sm leading-6 text-[var(--kr-gov-text-secondary)]">{form.body || "-"}</p>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-[var(--kr-gov-text-primary)]">{form.popupType}</span>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-[var(--kr-gov-text-primary)]">{form.displayScope}</span>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-[var(--kr-gov-text-primary)]">{form.closePolicy}</span>
              </div>
            </article>
            <article className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white p-5 shadow-sm">
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-700">{en ? "Operator Checklist" : "운영 체크리스트"}</p>
              <ul className="mt-4 space-y-3 text-sm leading-6 text-[var(--kr-gov-text-secondary)]">
                <li>{en ? "Confirm the linked notice or landing page is already published." : "연결된 공지 또는 랜딩 페이지가 먼저 배포되었는지 확인합니다."}</li>
                <li>{en ? "Avoid overlapping exposure windows with higher-priority blocking popups." : "상위 우선순위 차단형 팝업과 노출 기간이 겹치지 않도록 조정합니다."}</li>
                <li>{en ? "Verify dismiss policy and audience scope before switching to ACTIVE." : "ACTIVE 전환 전에 닫기 정책과 대상 범위를 최종 검증합니다."}</li>
              </ul>
            </article>
          </section>

          <MemberActionBar
            data-help-id="popup-edit-actions"
            description={en ? "Popup detail now loads and saves through the admin content API while preserving the existing form layout." : "기존 폼 레이아웃을 유지한 채 관리자 콘텐츠 API로 팝업 상세 조회와 저장이 연결되었습니다."}
            eyebrow={en ? "Content Ops" : "콘텐츠 운영"}
            primary={<MemberButton className={`${getMemberButtonClassName({ variant: "primary", size: "lg" })} min-w-[180px] justify-center`} type="submit">{en ? "Save Popup" : "팝업 저장"}</MemberButton>}
            secondary={{
              label: en ? "Reset Changes" : "변경 초기화",
              onClick: handleReset
            }}
            tertiary={{
              label: en ? "Back to Admin Home" : "관리자 홈으로",
              onClick: () => navigate(buildLocalizedPath("/admin/", "/en/admin/"))
            }}
            title={en ? "Review exposure timing and copy before activation" : "활성화 전 노출 시점과 문구를 다시 확인하세요"}
          />
        </AdminEditPageFrame>
      </form>
    </AdminPageShell>
  );
}
