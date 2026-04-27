import { FormEvent, type ReactNode, useEffect, useMemo, useState } from "react";
import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { logGovernanceScope } from "../../app/policy/debug";
import { fetchExternalConnectionFormPage, saveExternalConnection } from "../../lib/api/ops";
import type { ExternalConnectionFormPagePayload } from "../../lib/api/opsTypes";
import { buildLocalizedPath, isEnglish, navigate } from "../../lib/navigation/runtime";
import { AdminPageShell } from "../admin-entry/AdminPageShell";
import { CollectionResultPanel, PageStatusNotice, SummaryMetricCard } from "../admin-ui/common";
import { AdminEditPageFrame } from "../admin-ui/pageFrames";
import { AdminInput, AdminSelect, AdminTextarea, MemberActionBar } from "../member/common";

type ConnectionFormState = {
  connectionName: string;
  connectionId: string;
  partnerName: string;
  endpointUrl: string;
  protocol: string;
  authMethod: string;
  syncMode: string;
  retryPolicy: string;
  timeoutSeconds: string;
  dataScope: string;
  ownerName: string;
  ownerContact: string;
  operationStatus: string;
  maintenanceWindow: string;
  notes: string;
};

type ExternalConnectionFormMode = "add" | "edit";

const EMPTY_FORM: ConnectionFormState = {
  connectionName: "",
  connectionId: "",
  partnerName: "",
  endpointUrl: "https://",
  protocol: "REST",
  authMethod: "OAUTH2",
  syncMode: "SCHEDULED",
  retryPolicy: "EXP_BACKOFF_3",
  timeoutSeconds: "30",
  dataScope: "",
  ownerName: "",
  ownerContact: "",
  operationStatus: "REVIEW",
  maintenanceWindow: "Sun 01:00-02:00",
  notes: ""
};

function stringOf(row: Record<string, unknown> | null | undefined, ...keys: string[]) {
  if (!row) {
    return "";
  }
  for (const key of keys) {
    const value = row[key];
    if (value !== null && value !== undefined) {
      const text = String(value).trim();
      if (text) {
        return text;
      }
    }
  }
  return "";
}

function mapProfileToForm(profile: Record<string, unknown> | null | undefined): ConnectionFormState {
  return {
    connectionName: stringOf(profile, "connectionName"),
    connectionId: stringOf(profile, "connectionId"),
    partnerName: stringOf(profile, "partnerName"),
    endpointUrl: stringOf(profile, "endpointUrl") || "https://",
    protocol: stringOf(profile, "protocol") || "REST",
    authMethod: stringOf(profile, "authMethod") || "OAUTH2",
    syncMode: stringOf(profile, "syncMode") || "SCHEDULED",
    retryPolicy: stringOf(profile, "retryPolicy") || "EXP_BACKOFF_3",
    timeoutSeconds: stringOf(profile, "timeoutSeconds") || "30",
    dataScope: stringOf(profile, "dataScope"),
    ownerName: stringOf(profile, "ownerName"),
    ownerContact: stringOf(profile, "ownerContact"),
    operationStatus: stringOf(profile, "operationStatus") || "REVIEW",
    maintenanceWindow: stringOf(profile, "maintenanceWindow") || "Sun 01:00-02:00",
    notes: stringOf(profile, "notes")
  };
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

function SectionCard({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white shadow-sm">
      <div className="border-b border-[var(--kr-gov-border-light)] bg-slate-50 px-6 py-5">
        <h2 className="text-base font-black text-[var(--kr-gov-text-primary)]">{title}</h2>
        <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">{description}</p>
      </div>
      <div className="p-6">{children}</div>
    </section>
  );
}

function buildEditHref(connectionId: string) {
  const search = new URLSearchParams();
  if (connectionId.trim()) {
    search.set("connectionId", connectionId);
  }
  const path = buildLocalizedPath("/admin/external/connection_edit", "/en/admin/external/connection_edit");
  return search.toString() ? `${path}?${search.toString()}` : path;
}

function helpId(mode: ExternalConnectionFormMode, suffix: string) {
  return `external-connection-${mode}-${suffix}`;
}

export function ExternalConnectionFormMigrationPage({ mode = "edit" }: { mode?: ExternalConnectionFormMode }) {
  const en = isEnglish();
  const search = useMemo(() => new URLSearchParams(window.location.search), []);
  const queryConnectionId = search.get("connectionId") || "";
  const pageState = useAsyncValue<ExternalConnectionFormPagePayload>(
    () => fetchExternalConnectionFormPage(mode, queryConnectionId || undefined),
    [mode, queryConnectionId],
    {}
  );
  const page = pageState.value;
  const loadedProfile = useMemo(() => mapProfileToForm((page?.connectionProfile || null) as Record<string, unknown> | null), [page]);
  const supportSummary = useMemo(() => ((page?.externalConnectionFormSummary || []) as Array<Record<string, string>>), [page]);
  const issueRows = useMemo(() => ((page?.externalConnectionIssueRows || []) as Array<Record<string, string>>), [page]);
  const quickLinks = useMemo(() => ((page?.externalConnectionQuickLinks || []) as Array<Record<string, string>>), [page]);
  const guidance = useMemo(() => ((page?.externalConnectionGuidance || []) as Array<Record<string, string>>), [page]);
  const [baselineForm, setBaselineForm] = useState<ConnectionFormState>(EMPTY_FORM);
  const [form, setForm] = useState<ConnectionFormState>(EMPTY_FORM);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const isAddMode = mode === "add";

  useEffect(() => {
    if (!page) {
      return;
    }
    setBaselineForm(loadedProfile);
    setForm(loadedProfile);
  }, [loadedProfile, page]);

  const completionRatio = useMemo(() => {
    const requiredFields = [form.connectionName, form.connectionId, form.partnerName, form.endpointUrl, form.ownerName, form.ownerContact];
    return Math.round((requiredFields.filter((value) => value.trim()).length / requiredFields.length) * 100);
  }, [form]);

  const dirtyCount = useMemo(
    () => Object.keys(form).filter((key) => form[key as keyof ConnectionFormState] !== baselineForm[key as keyof ConnectionFormState]).length,
    [baselineForm, form]
  );

  useEffect(() => {
    if (!page) {
      return;
    }
    logGovernanceScope("PAGE", isAddMode ? "external-connection-add" : "external-connection-edit", {
      language: en ? "en" : "ko",
      connectionId: form.connectionId,
      protocol: form.protocol,
      authMethod: form.authMethod,
      operationStatus: form.operationStatus
    });
  }, [en, form.authMethod, form.connectionId, form.operationStatus, form.protocol, isAddMode, page]);

  function updateField<K extends keyof ConnectionFormState>(key: K, value: ConnectionFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function handleReset() {
    setForm(baselineForm);
    setMessage("");
    setError("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");

    if (!form.connectionName.trim() || !form.connectionId.trim()) {
      setError(en ? "Enter both connection name and connection ID." : "연계명과 연계 ID를 입력하세요.");
      return;
    }
    if (!form.partnerName.trim() || !form.endpointUrl.trim()) {
      setError(en ? "Enter the partner and endpoint URL." : "연계 기관과 엔드포인트 URL을 입력하세요.");
      return;
    }
    if (!form.ownerName.trim() || !form.ownerContact.trim()) {
      setError(en ? "Enter the owner name and contact." : "담당자 이름과 연락처를 입력하세요.");
      return;
    }

    setSaving(true);
    try {
      const result = await saveExternalConnection({
        ...form,
        mode: isAddMode ? "add" : "edit",
        originalConnectionId: isAddMode ? "" : baselineForm.connectionId
      });
      const nextForm = mapProfileToForm((result.connectionProfile || null) as Record<string, unknown> | null);
      setBaselineForm(nextForm);
      setForm(nextForm);
      setMessage(stringOf(result, "message") || (en ? "External connection profile saved." : "외부연계 프로필을 저장했습니다."));
      logGovernanceScope("ACTION", isAddMode ? "external-connection-add-save" : "external-connection-edit-save", {
        connectionId: nextForm.connectionId,
        protocol: nextForm.protocol,
        authMethod: nextForm.authMethod,
        syncMode: nextForm.syncMode,
        operationStatus: nextForm.operationStatus,
        dirtyCount
      });
      if (isAddMode && nextForm.connectionId) {
        window.setTimeout(() => navigate(buildEditHref(nextForm.connectionId)), 300);
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : (en ? "Failed to save external connection." : "외부연계 저장에 실패했습니다."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminPageShell
      breadcrumbs={[
        { label: en ? "Home" : "홈", href: buildLocalizedPath("/admin/", "/en/admin/") },
        { label: en ? "External Integration" : "외부 연계" },
        { label: isAddMode ? (en ? "Connection Add" : "연계 등록") : (en ? "Connection Edit" : "연계 수정") }
      ]}
      title={isAddMode ? (en ? "Connection Add" : "연계 등록") : (en ? "Connection Edit" : "연계 수정")}
      subtitle={isAddMode
        ? (en ? "Register a new external connection profile with endpoint, auth, sync, and owner details." : "새 외부 연계 프로필의 엔드포인트, 인증, 동기화, 운영 담당 정보를 등록합니다.")
        : (en ? "Adjust endpoint, auth, sync, and owner settings for the selected external connection." : "선택한 외부 연계의 엔드포인트, 인증, 동기화, 운영 담당 설정을 수정합니다.")}
      loading={pageState.loading && !page}
      loadingLabel={en ? "Loading external connection form..." : "외부연계 정보를 불러오는 중입니다."}
    >
      <form onSubmit={handleSubmit}>
        <AdminEditPageFrame>
          {pageState.error ? <PageStatusNotice tone="error">{pageState.error}</PageStatusNotice> : null}
          {message ? <PageStatusNotice tone="success">{message}</PageStatusNotice> : null}
          {error ? <PageStatusNotice tone="error">{error}</PageStatusNotice> : null}

          <section className="grid grid-cols-1 gap-4 xl:grid-cols-4" data-help-id={helpId(mode, "summary")}>
            <article className="rounded-[var(--kr-gov-radius)] border border-blue-200 bg-[linear-gradient(135deg,rgba(239,246,255,0.96),rgba(255,255,255,0.98))] p-5 shadow-sm">
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[var(--kr-gov-blue)]">{en ? "Readiness" : "작성 진행률"}</p>
              <p className="mt-3 text-3xl font-black text-[var(--kr-gov-text-primary)]">{completionRatio}%</p>
              <p className="mt-2 text-sm text-[var(--kr-gov-text-secondary)]">{en ? "Required connection fields completed." : "필수 연계 설정 기준 작성 완료율입니다."}</p>
            </article>
            <article className="rounded-[var(--kr-gov-radius)] border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-emerald-700">{en ? "Sync Mode" : "동기화 모드"}</p>
              <p className="mt-3 text-xl font-black text-[var(--kr-gov-text-primary)]">{form.syncMode || "-"}</p>
              <p className="mt-2 text-sm text-[var(--kr-gov-text-secondary)]">{en ? "Current message delivery policy." : "현재 메시지 전달 기준입니다."}</p>
            </article>
            <article className="rounded-[var(--kr-gov-radius)] border border-amber-200 bg-amber-50 p-5 shadow-sm">
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-amber-700">{en ? "Changed Fields" : "변경 항목 수"}</p>
              <p className="mt-3 text-xl font-black text-[var(--kr-gov-text-primary)]">{dirtyCount}</p>
              <p className="mt-2 text-sm text-[var(--kr-gov-text-secondary)]">{en ? "Fields changed from the loaded baseline." : "초기 로드 기준에서 변경된 설정 항목 수입니다."}</p>
            </article>
            <article className="rounded-[var(--kr-gov-radius)] border border-slate-200 bg-slate-50 p-5 shadow-sm">
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-700">{en ? "Status" : "운영 상태"}</p>
              <p className="mt-3 text-xl font-black text-[var(--kr-gov-text-primary)]">{form.operationStatus || "-"}</p>
              <p className="mt-2 text-sm text-[var(--kr-gov-text-secondary)]">{en ? "Current connection availability state." : "현재 연계 운영 상태입니다."}</p>
            </article>
          </section>

          <div data-help-id={helpId(mode, "profile")}>
            <SectionCard title={en ? "Partner Connection Profile" : "연계 기본 정보"} description={en ? "Align partner identity and endpoint baseline before touching auth or replay policy." : "인증과 재처리 정책을 바꾸기 전에 연계 기관 식별 정보와 엔드포인트 기준을 먼저 맞춥니다."}>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
              <Field label={en ? "Connection Name" : "연계명"} required><AdminInput value={form.connectionName} onChange={(event) => updateField("connectionName", event.target.value)} /></Field>
              <Field label={en ? "Connection ID" : "연계 ID"} required><AdminInput className={!isAddMode ? "bg-gray-50 text-gray-600" : ""} readOnly={!isAddMode} value={form.connectionId} onChange={(event) => updateField("connectionId", event.target.value.toUpperCase())} /></Field>
              <Field label={en ? "Partner" : "연계 기관"} required><AdminInput value={form.partnerName} onChange={(event) => updateField("partnerName", event.target.value)} /></Field>
              <div className="md:col-span-2 xl:col-span-3">
                <Field label={en ? "Endpoint URL" : "엔드포인트 URL"} required><AdminInput value={form.endpointUrl} onChange={(event) => updateField("endpointUrl", event.target.value)} /></Field>
              </div>
              <Field label={en ? "Protocol" : "프로토콜"}>
                <AdminSelect value={form.protocol} onChange={(event) => updateField("protocol", event.target.value)}>
                  <option value="REST">REST</option>
                  <option value="SOAP">SOAP</option>
                  <option value="SFTP">SFTP</option>
                  <option value="MQ">Message Queue</option>
                </AdminSelect>
              </Field>
              <Field label={en ? "Auth Method" : "인증 방식"}>
                <AdminSelect value={form.authMethod} onChange={(event) => updateField("authMethod", event.target.value)}>
                  <option value="OAUTH2">OAuth2 Client</option>
                  <option value="API_KEY">API Key</option>
                  <option value="MUTUAL_TLS">mTLS</option>
                  <option value="BASIC">Basic Auth</option>
                  <option value="OBSERVED">Observed Only</option>
                </AdminSelect>
              </Field>
              <Field label={en ? "Data Scope" : "동기화 범위"}><AdminInput value={form.dataScope} onChange={(event) => updateField("dataScope", event.target.value)} /></Field>
            </div>
            </SectionCard>
          </div>

          <div data-help-id={helpId(mode, "sync-policy")}>
            <SectionCard title={en ? "Sync And Reliability Policy" : "동기화 및 안정성 정책"} description={en ? "Tune sync direction, timeout, and retry boundaries for this partner connection." : "해당 연계의 동기화 방향, timeout, 재시도 경계를 조정합니다."}>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
              <Field label={en ? "Sync Mode" : "동기화 모드"}>
                <AdminSelect value={form.syncMode} onChange={(event) => updateField("syncMode", event.target.value)}>
                  <option value="SCHEDULED">{en ? "Scheduled pull" : "스케줄 수집"}</option>
                  <option value="WEBHOOK">{en ? "Webhook push" : "웹훅 수신"}</option>
                  <option value="HYBRID">{en ? "Hybrid" : "혼합형"}</option>
                </AdminSelect>
              </Field>
              <Field label={en ? "Retry Policy" : "재시도 정책"}>
                <AdminSelect value={form.retryPolicy} onChange={(event) => updateField("retryPolicy", event.target.value)}>
                  <option value="EXP_BACKOFF_3">{en ? "Exponential backoff x3" : "지수 백오프 3회"}</option>
                  <option value="LINEAR_5">{en ? "Linear retry x5" : "선형 재시도 5회"}</option>
                  <option value="MANUAL">{en ? "Manual replay only" : "수동 재처리만"}</option>
                </AdminSelect>
              </Field>
              <Field label={en ? "Timeout (sec)" : "Timeout(초)"}><AdminInput inputMode="numeric" value={form.timeoutSeconds} onChange={(event) => updateField("timeoutSeconds", event.target.value.replace(/[^0-9]/g, ""))} /></Field>
              <Field label={en ? "Maintenance Window" : "점검 시간"}><AdminInput value={form.maintenanceWindow} onChange={(event) => updateField("maintenanceWindow", event.target.value)} /></Field>
            </div>
            </SectionCard>
          </div>

          <div data-help-id={helpId(mode, "ownership")}>
            <SectionCard title={en ? "Operations Ownership" : "운영 담당 체계"} description={en ? "Keep owner, status, and handover notes aligned before changing live traffic." : "실시간 트래픽 설정을 바꾸기 전에 담당자, 상태, 인수인계 메모를 함께 정리합니다."}>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <Field label={en ? "Owner" : "담당자"} required><AdminInput value={form.ownerName} onChange={(event) => updateField("ownerName", event.target.value)} /></Field>
              <Field label={en ? "Owner Contact" : "담당자 연락처"} required><AdminInput value={form.ownerContact} onChange={(event) => updateField("ownerContact", event.target.value)} /></Field>
              <Field label={en ? "Operation Status" : "운영 상태"}>
                <AdminSelect value={form.operationStatus} onChange={(event) => updateField("operationStatus", event.target.value)}>
                  <option value="ACTIVE">{en ? "Active" : "운영중"}</option>
                  <option value="REVIEW">{en ? "Review" : "검토중"}</option>
                  <option value="MAINTENANCE">{en ? "Maintenance" : "점검중"}</option>
                  <option value="DISABLED">{en ? "Disabled" : "비활성"}</option>
                </AdminSelect>
              </Field>
              <div className="md:col-span-2"><Field label={en ? "Operational Notes" : "운영 메모"}><AdminTextarea className="min-h-[120px]" value={form.notes} onChange={(event) => updateField("notes", event.target.value)} /></Field></div>
            </div>
            </SectionCard>
          </div>

          <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {supportSummary.map((item, index) => (
              <SummaryMetricCard
                key={`${stringOf(item, "title")}-${index}`}
                title={stringOf(item, "title")}
                value={stringOf(item, "value")}
                description={stringOf(item, "description")}
              />
            ))}
          </section>

          <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.25fr,1fr]">
            <CollectionResultPanel
              title={en ? "Recent Integration Issues" : "최근 연계 이슈"}
              description={isAddMode
                ? (en ? "Review nearby incidents before opening a new partner profile." : "새 파트너 프로필을 열기 전에 주변 연계 이슈를 먼저 확인합니다.")
                : (en ? "Check repeated failures or warnings linked to this connection before saving changes." : "저장 전에 이 연계와 연결된 반복 실패 또는 경고를 먼저 확인합니다.")}
              icon="warning"
            >
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="text-xs font-black uppercase tracking-[0.08em] text-[var(--kr-gov-text-secondary)]">
                    <tr>
                      <th className="px-3 py-2">{en ? "Time" : "시각"}</th>
                      <th className="px-3 py-2">{en ? "Connection" : "연계"}</th>
                      <th className="px-3 py-2">{en ? "Type" : "유형"}</th>
                      <th className="px-3 py-2">{en ? "Status" : "상태"}</th>
                      <th className="px-3 py-2">{en ? "Detail" : "상세"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {issueRows.map((row, index) => (
                      <tr key={`${stringOf(row, "occurredAt")}-${index}`} className="border-t border-[var(--kr-gov-border-light)]">
                        <td className="px-3 py-3 whitespace-nowrap">{stringOf(row, "occurredAt")}</td>
                        <td className="px-3 py-3">
                          <a className="text-[var(--kr-gov-blue)] underline-offset-2 hover:underline" href={stringOf(row, "targetRoute")}>
                            {stringOf(row, "connectionName", "connectionId")}
                          </a>
                        </td>
                        <td className="px-3 py-3">{stringOf(row, "issueType")}</td>
                        <td className="px-3 py-3">{stringOf(row, "status")}</td>
                        <td className="px-3 py-3">{stringOf(row, "detail")}</td>
                      </tr>
                    ))}
                    {issueRows.length === 0 ? (
                      <tr className="border-t border-[var(--kr-gov-border-light)]">
                        <td className="px-3 py-6 text-[var(--kr-gov-text-secondary)]" colSpan={5}>
                          {en ? "No recent integration issues were found." : "최근 외부연계 이슈가 없습니다."}
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </CollectionResultPanel>

            <div className="space-y-4">
              <CollectionResultPanel
                title={en ? "Quick Links" : "바로가기"}
                description={en ? "Move into surrounding external integration views from the same editing flow." : "같은 수정 흐름에서 주변 외부연계 화면으로 이동합니다."}
                icon="link"
              >
                <div className="grid grid-cols-1 gap-3">
                  {quickLinks.map((item, index) => (
                    <a
                      key={`${stringOf(item, "label")}-${index}`}
                      className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] px-4 py-3 text-sm font-bold text-[var(--kr-gov-blue)] hover:border-[var(--kr-gov-blue)]"
                      href={stringOf(item, "targetRoute", "href")}
                    >
                      {stringOf(item, "label", "title")}
                    </a>
                  ))}
                </div>
              </CollectionResultPanel>

              <CollectionResultPanel
                title={en ? "Operating Guidance" : "운영 가이드"}
                description={en ? "Use the same baseline when editing ownership, auth, or retry policy." : "담당, 인증, 재시도 정책을 수정할 때 같은 기준으로 판단합니다."}
                icon="fact_check"
              >
                <div className="space-y-3">
                  {guidance.map((item, index) => (
                    <article key={`${stringOf(item, "title")}-${index}`} className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.08em] text-slate-700">{stringOf(item, "tone") || "INFO"}</span>
                        <h3 className="text-sm font-black text-[var(--kr-gov-text-primary)]">{stringOf(item, "title")}</h3>
                      </div>
                      <p className="mt-2 text-sm text-[var(--kr-gov-text-secondary)]">{stringOf(item, "body", "description")}</p>
                    </article>
                  ))}
                </div>
              </CollectionResultPanel>
            </div>
          </section>

          <MemberActionBar
            eyebrow={en ? "External Integration" : "외부 연계"}
            title={isAddMode ? (en ? "Register the new connection profile" : "새 연계 프로필 등록") : (en ? "Save the connection profile update" : "연계 프로필 수정 저장")}
            description={isAddMode
              ? (en ? "The profile is stored immediately and can be reviewed from the registry list." : "프로필은 즉시 저장되며 외부연계 목록에서 바로 확인할 수 있습니다.")
              : (en ? "Changes are written to the current registry profile and reflected in the list view." : "변경 내용은 현재 레지스트리 프로필에 저장되고 목록 화면에 반영됩니다.")}
            secondary={{ label: en ? "Reset Changes" : "변경 취소", onClick: handleReset }}
            tertiary={{ label: en ? "Open List" : "목록 열기", onClick: () => navigate(buildLocalizedPath("/admin/external/connection_list", "/en/admin/external/connection_list")) }}
            primary={<button className="inline-flex min-w-[180px] items-center justify-center rounded-[var(--kr-gov-radius)] bg-[var(--kr-gov-blue)] px-6 py-4 text-sm font-bold text-white shadow-sm transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60" disabled={saving || pageState.loading} type="submit">{saving ? (en ? "Saving..." : "저장 중...") : (isAddMode ? (en ? "Save Connection" : "연계 등록 저장") : (en ? "Save Changes" : "연계 수정 저장"))}</button>}
            dataHelpId={helpId(mode, "actions")}
          />
        </AdminEditPageFrame>
      </form>
    </AdminPageShell>
  );
}

export function ExternalConnectionEditMigrationPage() {
  return <ExternalConnectionFormMigrationPage mode="edit" />;
}
