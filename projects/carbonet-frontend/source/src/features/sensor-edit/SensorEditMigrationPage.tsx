import { FormEvent, ReactNode, useMemo, useState } from "react";
import { logGovernanceScope } from "../../app/policy/debug";
import { buildLocalizedPath, isEnglish, navigate } from "../../lib/navigation/runtime";
import { AdminPageShell } from "../admin-entry/AdminPageShell";
import { AdminEditPageFrame } from "../admin-ui/pageFrames";
import { AdminInput, AdminSelect, AdminTextarea, MemberActionBar, PageStatusNotice } from "../member/common";

type SensorFormState = {
  sensorName: string;
  sensorId: string;
  sensorType: string;
  siteName: string;
  zoneName: string;
  installLocation: string;
  protocol: string;
  samplingSeconds: string;
  retentionDays: string;
  thresholdWarning: string;
  thresholdCritical: string;
  managerName: string;
  managerContact: string;
  notifyChannel: string;
  calibrationCycle: string;
  description: string;
  lifecycleStatus: string;
  maintenanceWindow: string;
};

type SensorContextState = {
  fingerprint: string;
  detectedAt: string;
  sourceIp: string;
  targetUrl: string;
  eventCount: string;
  blockStatusLabel: string;
  targetRoute: string;
};

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

function mapLifecycleStatus(value: string) {
  const normalized = value.trim().toUpperCase();
  if (normalized === "BLOCKED" || normalized === "ALERT") {
    return "REVIEW";
  }
  if (normalized === "MAINTENANCE") {
    return "MAINTENANCE";
  }
  if (normalized === "DISABLED" || normalized === "INACTIVE") {
    return "DISABLED";
  }
  return "ACTIVE";
}

function buildInitialForm(en: boolean): SensorFormState {
  const search = new URLSearchParams(window.location.search);
  const targetUrl = search.get("targetUrl") || "";
  const sourceIp = search.get("sourceIp") || "";
  const note = search.get("note") || "";
  const detail = search.get("detail") || "";
  return {
    sensorName: search.get("sensorName") || (en ? "Tank 02 gas concentration sensor" : "저장탱크 02 가스농도 센서"),
    sensorId: search.get("sensorId") || "SNSR-TK02-GAS-001",
    sensorType: search.get("sensorType") || "GAS",
    siteName: search.get("siteName") || "CCUS 진흥센터",
    zoneName: search.get("zoneName") || (en ? "Storage area A" : "저장구역 A"),
    installLocation: search.get("installLocation") || targetUrl || sourceIp || (en ? "North valve, tank line 2" : "2번 탱크 북측 밸브"),
    protocol: search.get("protocol") || "MQTT",
    samplingSeconds: search.get("samplingSeconds") || "30",
    retentionDays: search.get("retentionDays") || "365",
    thresholdWarning: search.get("thresholdWarning") || "65 ppm",
    thresholdCritical: search.get("thresholdCritical") || "80 ppm",
    managerName: search.get("managerName") || (en ? "Operations Team A" : "운영팀 A"),
    managerContact: search.get("managerContact") || "ops-a@carbonet.local",
    notifyChannel: search.get("notifyChannel") || "SLACK",
    calibrationCycle: search.get("calibrationCycle") || "MONTHLY",
    description: search.get("description")
      || note
      || detail
      || (en ? "Monitor tank gas concentration and escalate through monitoring channel on repeated threshold breach." : "탱크 가스 농도를 감시하고 임계값 반복 초과 시 모니터링 채널로 즉시 승격합니다."),
    lifecycleStatus: search.get("lifecycleStatus") || mapLifecycleStatus(search.get("status") || ""),
    maintenanceWindow: search.get("maintenanceWindow") || "Sun 02:00-03:00"
  };
}

function buildContext(): SensorContextState {
  const search = new URLSearchParams(window.location.search);
  return {
    fingerprint: search.get("fingerprint") || "",
    detectedAt: search.get("detectedAt") || "",
    sourceIp: search.get("sourceIp") || "",
    targetUrl: search.get("targetUrl") || "",
    eventCount: search.get("eventCount") || "",
    blockStatusLabel: search.get("blockStatusLabel") || "",
    targetRoute: search.get("targetRoute") || ""
  };
}

function buildSensorAddCloneHref(form: SensorFormState) {
  const search = new URLSearchParams({
    sensorName: form.sensorName,
    sensorType: form.sensorType,
    siteName: form.siteName,
    zoneName: form.zoneName,
    installLocation: form.installLocation,
    protocol: form.protocol,
    samplingSeconds: form.samplingSeconds,
    retentionDays: form.retentionDays,
    thresholdWarning: form.thresholdWarning,
    thresholdCritical: form.thresholdCritical,
    managerName: form.managerName,
    managerContact: form.managerContact,
    notifyChannel: form.notifyChannel,
    calibrationCycle: form.calibrationCycle,
    description: form.description
  });
  return `${buildLocalizedPath("/admin/monitoring/sensor_add", "/en/admin/monitoring/sensor_add")}?${search.toString()}`;
}

export function SensorEditMigrationPage() {
  const en = isEnglish();
  const initialForm = useMemo(() => buildInitialForm(en), [en]);
  const context = useMemo(() => buildContext(), []);
  const [form, setForm] = useState<SensorFormState>(initialForm);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const completionRatio = useMemo(() => {
    const requiredFields = [
      form.sensorName,
      form.sensorId,
      form.siteName,
      form.zoneName,
      form.installLocation,
      form.thresholdWarning,
      form.thresholdCritical,
      form.managerName,
      form.managerContact
    ];
    const completedCount = requiredFields.filter((value) => value.trim()).length;
    return Math.round((completedCount / requiredFields.length) * 100);
  }, [form]);

  const dirtyCount = useMemo(
    () => Object.keys(form).filter((key) => form[key as keyof SensorFormState] !== initialForm[key as keyof SensorFormState]).length,
    [form, initialForm]
  );

  function updateField<K extends keyof SensorFormState>(key: K, value: SensorFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function handleReset() {
    setForm(initialForm);
    setMessage("");
    setError("");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");

    if (!form.sensorName.trim() || !form.sensorId.trim()) {
      setError(en ? "Enter both sensor name and sensor ID." : "센서명과 센서 ID를 입력하세요.");
      return;
    }
    if (!form.zoneName.trim() || !form.installLocation.trim()) {
      setError(en ? "Enter the zone and installation location." : "설치 권역과 설치 위치를 입력하세요.");
      return;
    }
    if (!form.managerName.trim() || !form.managerContact.trim()) {
      setError(en ? "Enter the owner name and contact." : "담당자 이름과 연락처를 입력하세요.");
      return;
    }

    logGovernanceScope("ACTION", "monitoring-sensor-edit-submit", {
      sensorId: form.sensorId,
      sensorType: form.sensorType,
      protocol: form.protocol,
      lifecycleStatus: form.lifecycleStatus,
      dirtyCount
    });
    setMessage(
      en
        ? "Sensor configuration draft is updated. Connect the backend save API when sensor master update is ready."
        : "센서 설정 초안이 갱신되었습니다. 센서 마스터 수정 API가 준비되면 바로 저장 연동할 수 있습니다."
    );
  }

  return (
    <AdminPageShell
      breadcrumbs={[
        { label: en ? "Home" : "홈", href: buildLocalizedPath("/admin/", "/en/admin/") },
        { label: en ? "Monitoring" : "모니터링" },
        { label: en ? "Sensor Settings" : "센서 설정" }
      ]}
      title={en ? "Sensor Settings" : "센서 설정"}
      subtitle={en ? "Adjust collection, thresholds, ownership, and maintenance settings for a registered sensor." : "등록된 센서의 수집, 임계값, 담당 체계, 유지보수 설정을 조정합니다."}
    >
      <form onSubmit={handleSubmit}>
        <AdminEditPageFrame>
          {message ? <PageStatusNotice tone="success">{message}</PageStatusNotice> : null}
          {error ? <PageStatusNotice tone="error">{error}</PageStatusNotice> : null}

          <section className="grid grid-cols-1 gap-4 xl:grid-cols-4">
            <article className="rounded-[var(--kr-gov-radius)] border border-blue-200 bg-[linear-gradient(135deg,rgba(239,246,255,0.96),rgba(255,255,255,0.98))] p-5 shadow-sm">
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[var(--kr-gov-blue)]">{en ? "Readiness" : "작성 진행률"}</p>
              <p className="mt-3 text-3xl font-black text-[var(--kr-gov-text-primary)]">{completionRatio}%</p>
              <p className="mt-2 text-sm text-[var(--kr-gov-text-secondary)]">{en ? "Required configuration fields completed." : "필수 설정 항목 기준 작성 완료율입니다."}</p>
            </article>
            <article className="rounded-[var(--kr-gov-radius)] border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-emerald-700">{en ? "Lifecycle" : "운영 상태"}</p>
              <p className="mt-3 text-xl font-black text-[var(--kr-gov-text-primary)]">{form.lifecycleStatus}</p>
              <p className="mt-2 text-sm text-[var(--kr-gov-text-secondary)]">{en ? "Current runtime status of this sensor profile." : "현재 센서 프로필의 운영 상태입니다."}</p>
            </article>
            <article className="rounded-[var(--kr-gov-radius)] border border-amber-200 bg-amber-50 p-5 shadow-sm">
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-amber-700">{en ? "Changed Fields" : "변경 항목 수"}</p>
              <p className="mt-3 text-xl font-black text-[var(--kr-gov-text-primary)]">{dirtyCount}</p>
              <p className="mt-2 text-sm text-[var(--kr-gov-text-secondary)]">{en ? "Fields modified from the loaded baseline." : "초기 로드 기준에서 변경된 설정 항목 수입니다."}</p>
            </article>
            <article className="rounded-[var(--kr-gov-radius)] border border-slate-200 bg-slate-50 p-5 shadow-sm">
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-700">{en ? "Maintenance Window" : "점검 시간"}</p>
              <p className="mt-3 text-xl font-black text-[var(--kr-gov-text-primary)]">{form.maintenanceWindow}</p>
              <p className="mt-2 text-sm text-[var(--kr-gov-text-secondary)]">{en ? "Reserved maintenance and recalibration slot." : "유지보수 및 재보정 예약 구간입니다."}</p>
            </article>
          </section>

          <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-50 px-5 py-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-bold text-[var(--kr-gov-text-primary)]">
                  {en ? "Create a related sensor from this configuration" : "현재 설정을 기준으로 신규 센서 등록"}
                </p>
                <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">
                  {en
                    ? "Open the registration screen with the current settings copied over, then assign a new sensor ID."
                    : "현재 설정값을 복사한 상태로 등록 화면을 열고 새 센서 ID만 바꿔서 신규 등록할 수 있습니다."}
                </p>
              </div>
              <a
                className="inline-flex min-h-[44px] min-w-[180px] items-center justify-center rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white px-4 py-2 text-sm font-bold text-[var(--kr-gov-text-primary)] hover:border-[var(--kr-gov-blue)] hover:text-[var(--kr-gov-blue)]"
                href={buildSensorAddCloneHref(form)}
              >
                {en ? "Open Registration Clone" : "복제 등록 열기"}
              </a>
            </div>
          </div>

          <SectionCard
            data-help-id="sensor-edit-context"
            title={en ? "Linked Monitoring Context" : "연결된 모니터링 문맥"}
            description={en ? "Review the source event that opened this edit flow before applying sensor-level changes." : "센서 설정 변경 전에 이 수정 화면을 연 원본 모니터링 신호를 확인합니다."}
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <article className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-50 p-4">
                <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--kr-gov-text-secondary)]">{en ? "Fingerprint" : "지문값"}</p>
                <p className="mt-2 break-all text-sm font-bold text-[var(--kr-gov-text-primary)]">{context.fingerprint || "-"}</p>
              </article>
              <article className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-50 p-4">
                <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--kr-gov-text-secondary)]">{en ? "Detected At" : "감지 시각"}</p>
                <p className="mt-2 text-sm font-bold text-[var(--kr-gov-text-primary)]">{context.detectedAt || "-"}</p>
              </article>
              <article className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-50 p-4">
                <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--kr-gov-text-secondary)]">{en ? "Source IP" : "소스 IP"}</p>
                <p className="mt-2 text-sm font-bold text-[var(--kr-gov-text-primary)]">{context.sourceIp || "-"}</p>
              </article>
              <article className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-50 p-4">
                <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--kr-gov-text-secondary)]">{en ? "Grouped Events" : "묶인 이벤트 수"}</p>
                <p className="mt-2 text-sm font-bold text-[var(--kr-gov-text-primary)]">{context.eventCount || "-"}</p>
              </article>
            </div>
            <div className="mt-4 rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white p-4">
              <p className="text-sm font-bold text-[var(--kr-gov-text-primary)]">{en ? "Monitoring Target" : "모니터링 대상"}</p>
              <p className="mt-2 break-all text-sm text-[var(--kr-gov-text-secondary)]">{context.targetUrl || form.installLocation || "-"}</p>
              <p className="mt-3 text-sm text-[var(--kr-gov-text-secondary)]">
                {(en ? "Block status: " : "차단 상태: ") + (context.blockStatusLabel || "-")}
              </p>
              {context.targetRoute ? (
                <div className="mt-4">
                  <a
                    className="inline-flex min-h-[44px] min-w-[160px] items-center justify-center rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white px-4 py-2 text-sm font-bold text-[var(--kr-gov-text-primary)] hover:border-[var(--kr-gov-blue)] hover:text-[var(--kr-gov-blue)]"
                    href={context.targetRoute}
                  >
                    {en ? "Open Source Event" : "원본 이벤트 열기"}
                  </a>
                </div>
              ) : null}
            </div>
          </SectionCard>

          <SectionCard
            data-help-id="sensor-edit-profile"
            title={en ? "Basic Sensor Profile" : "기본 센서 정보"}
            description={en ? "Update the sensor identity and placement while keeping the registered asset code stable." : "등록 자산 코드는 유지하면서 센서 식별 정보와 설치 위치를 조정합니다."}
          >
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
              <Field label={en ? "Sensor Name" : "센서명"} required>
                <AdminInput value={form.sensorName} onChange={(event) => updateField("sensorName", event.target.value)} />
              </Field>
              <Field label={en ? "Sensor ID" : "센서 ID"} required>
                <AdminInput className="bg-gray-50 text-gray-600" readOnly value={form.sensorId} />
              </Field>
              <Field label={en ? "Sensor Type" : "센서 유형"}>
                <AdminSelect value={form.sensorType} onChange={(event) => updateField("sensorType", event.target.value)}>
                  <option value="TEMPERATURE">{en ? "Temperature" : "온도"}</option>
                  <option value="PRESSURE">{en ? "Pressure" : "압력"}</option>
                  <option value="FLOW">{en ? "Flow" : "유량"}</option>
                  <option value="GAS">{en ? "Gas Concentration" : "가스 농도"}</option>
                  <option value="VIBRATION">{en ? "Vibration" : "진동"}</option>
                </AdminSelect>
              </Field>
              <Field label={en ? "Site" : "설치 사이트"} required>
                <AdminInput value={form.siteName} onChange={(event) => updateField("siteName", event.target.value)} />
              </Field>
              <Field label={en ? "Zone / Area" : "권역 / 구역"} required>
                <AdminInput value={form.zoneName} onChange={(event) => updateField("zoneName", event.target.value)} />
              </Field>
              <Field label={en ? "Installation Location" : "설치 위치"} required>
                <AdminInput value={form.installLocation} onChange={(event) => updateField("installLocation", event.target.value)} />
              </Field>
            </div>
          </SectionCard>

          <SectionCard
            data-help-id="sensor-edit-threshold"
            title={en ? "Collection And Threshold Tuning" : "수집 및 임계값 조정"}
            description={en ? "Tune collection and escalation policy for the deployed sensor." : "배포된 센서의 수집 정책과 경보 승격 기준을 조정합니다."}
          >
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
              <Field label={en ? "Protocol" : "연동 프로토콜"}>
                <AdminSelect value={form.protocol} onChange={(event) => updateField("protocol", event.target.value)}>
                  <option value="MQTT">MQTT</option>
                  <option value="HTTP">HTTP Push</option>
                  <option value="MODBUS">Modbus TCP</option>
                  <option value="OPCUA">OPC-UA</option>
                </AdminSelect>
              </Field>
              <Field label={en ? "Sampling Interval (sec)" : "샘플링 주기(초)"}>
                <AdminInput inputMode="numeric" value={form.samplingSeconds} onChange={(event) => updateField("samplingSeconds", event.target.value.replace(/[^0-9]/g, ""))} />
              </Field>
              <Field label={en ? "Retention (days)" : "보관 기간(일)"}>
                <AdminInput inputMode="numeric" value={form.retentionDays} onChange={(event) => updateField("retentionDays", event.target.value.replace(/[^0-9]/g, ""))} />
              </Field>
              <Field label={en ? "Notification Channel" : "알림 채널"}>
                <AdminSelect value={form.notifyChannel} onChange={(event) => updateField("notifyChannel", event.target.value)}>
                  <option value="SLACK">Slack</option>
                  <option value="SMS">SMS</option>
                  <option value="EMAIL">Email</option>
                  <option value="DASHBOARD">{en ? "Dashboard only" : "대시보드만"}</option>
                </AdminSelect>
              </Field>
              <Field label={en ? "Warning Threshold" : "주의 임계값"} required>
                <AdminInput value={form.thresholdWarning} onChange={(event) => updateField("thresholdWarning", event.target.value)} />
              </Field>
              <Field label={en ? "Critical Threshold" : "위험 임계값"} required>
                <AdminInput value={form.thresholdCritical} onChange={(event) => updateField("thresholdCritical", event.target.value)} />
              </Field>
              <Field label={en ? "Calibration Cycle" : "보정 주기"}>
                <AdminSelect value={form.calibrationCycle} onChange={(event) => updateField("calibrationCycle", event.target.value)}>
                  <option value="WEEKLY">{en ? "Weekly" : "매주"}</option>
                  <option value="MONTHLY">{en ? "Monthly" : "매월"}</option>
                  <option value="QUARTERLY">{en ? "Quarterly" : "분기"}</option>
                  <option value="HALF_YEARLY">{en ? "Half-yearly" : "반기"}</option>
                </AdminSelect>
              </Field>
              <Field label={en ? "Maintenance Window" : "점검 시간"}>
                <AdminInput value={form.maintenanceWindow} onChange={(event) => updateField("maintenanceWindow", event.target.value)} />
              </Field>
            </div>
          </SectionCard>

          <SectionCard
            data-help-id="sensor-edit-ownership"
            title={en ? "Operations Ownership" : "운영 담당 체계"}
            description={en ? "Keep owner, status, and operator notes aligned before applying downstream changes." : "하위 시스템 반영 전 담당자, 운영 상태, 메모를 함께 정렬합니다."}
          >
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <Field label={en ? "Owner" : "담당자"} required>
                <AdminInput value={form.managerName} onChange={(event) => updateField("managerName", event.target.value)} />
              </Field>
              <Field label={en ? "Owner Contact" : "담당자 연락처"} required>
                <AdminInput value={form.managerContact} onChange={(event) => updateField("managerContact", event.target.value)} />
              </Field>
              <Field label={en ? "Lifecycle Status" : "운영 상태"}>
                <AdminSelect value={form.lifecycleStatus} onChange={(event) => updateField("lifecycleStatus", event.target.value)}>
                  <option value="ACTIVE">{en ? "Active" : "운영중"}</option>
                  <option value="MAINTENANCE">{en ? "Maintenance" : "점검중"}</option>
                  <option value="REVIEW">{en ? "Review" : "검토중"}</option>
                  <option value="DISABLED">{en ? "Disabled" : "비활성"}</option>
                </AdminSelect>
              </Field>
              <div className="md:col-span-2">
                <Field label={en ? "Operational Notes" : "운영 메모"}>
                  <AdminTextarea className="min-h-[120px]" value={form.description} onChange={(event) => updateField("description", event.target.value)} />
                </Field>
              </div>
            </div>
          </SectionCard>

          <MemberActionBar
            eyebrow={en ? "Monitoring Setup" : "모니터링 설정"}
            title={en ? "Tune the deployed sensor profile before rollout" : "배포된 센서 프로필을 조정한 뒤 반영"}
            description={
              en
                ? "This screen prepares a controlled edit flow for sensor master settings. Connect the update API and audit write path next."
                : "현재 화면은 센서 마스터 설정의 통제된 수정 흐름을 준비합니다. 다음 단계에서 수정 API와 감사 기록 경로를 연결하면 됩니다."
            }
            secondary={{ label: en ? "Reset Changes" : "변경 취소", onClick: handleReset }}
            tertiary={{ label: en ? "Back to Sensor List" : "센서 목록으로", onClick: () => navigate(buildLocalizedPath("/admin/monitoring/sensor_list", "/en/admin/monitoring/sensor_list")) }}
            primary={
              <button
                className="inline-flex min-w-[180px] items-center justify-center rounded-[var(--kr-gov-radius)] bg-[var(--kr-gov-blue)] px-6 py-4 text-sm font-bold text-white shadow-sm transition hover:brightness-110"
                type="submit"
              >
                {en ? "Validate Changes" : "변경 내용 검증"}
              </button>
            }
          />
        </AdminEditPageFrame>
      </form>
    </AdminPageShell>
  );
}
