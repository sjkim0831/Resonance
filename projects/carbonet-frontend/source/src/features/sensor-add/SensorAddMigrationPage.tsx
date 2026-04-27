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
};

const INITIAL_FORM: SensorFormState = {
  sensorName: "",
  sensorId: "",
  sensorType: "TEMPERATURE",
  siteName: "CCUS 진흥센터",
  zoneName: "",
  installLocation: "",
  protocol: "MQTT",
  samplingSeconds: "30",
  retentionDays: "365",
  thresholdWarning: "",
  thresholdCritical: "",
  managerName: "",
  managerContact: "",
  notifyChannel: "SLACK",
  calibrationCycle: "MONTHLY",
  description: ""
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

function buildSensorEditDraftHref(form: SensorFormState) {
  const search = new URLSearchParams({
    sensorId: form.sensorId,
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
    description: form.description,
    lifecycleStatus: "ACTIVE"
  });
  return `${buildLocalizedPath("/admin/monitoring/sensor_edit", "/en/admin/monitoring/sensor_edit")}?${search.toString()}`;
}

export function SensorAddMigrationPage() {
  const en = isEnglish();
  const [form, setForm] = useState<SensorFormState>(INITIAL_FORM);
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

  function updateField<K extends keyof SensorFormState>(key: K, value: SensorFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function handleReset() {
    setForm(INITIAL_FORM);
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
    if (!form.thresholdWarning.trim() || !form.thresholdCritical.trim()) {
      setError(en ? "Enter alert thresholds for warning and critical states." : "주의/위험 임계값을 입력하세요.");
      return;
    }
    if (!form.managerName.trim() || !form.managerContact.trim()) {
      setError(en ? "Enter the owner name and contact." : "담당자 이름과 연락처를 입력하세요.");
      return;
    }

    logGovernanceScope("ACTION", "monitoring-sensor-add-submit", {
      sensorId: form.sensorId,
      sensorType: form.sensorType,
      protocol: form.protocol,
      notifyChannel: form.notifyChannel,
      calibrationCycle: form.calibrationCycle
    });
    setMessage(
      en
        ? "Sensor registration draft is validated. Connect the backend save API when sensor master storage is ready."
        : "센서 등록 초안 검증이 완료되었습니다. 센서 마스터 저장소가 준비되면 저장 API를 바로 연결할 수 있습니다."
    );
  }

  return (
    <AdminPageShell
      breadcrumbs={[
        { label: en ? "Home" : "홈", href: buildLocalizedPath("/admin/", "/en/admin/") },
        { label: en ? "Monitoring" : "모니터링" },
        { label: en ? "Sensor Registration" : "센서 등록" }
      ]}
      title={en ? "Sensor Registration" : "센서 등록"}
      subtitle={en ? "Register a monitoring sensor with collection, threshold, and ownership settings." : "모니터링용 센서를 등록하고 수집 주기, 임계값, 담당 체계를 함께 설정합니다."}
    >
      <form onSubmit={handleSubmit}>
        <AdminEditPageFrame>
          {message ? <PageStatusNotice tone="success">{message}</PageStatusNotice> : null}
          {error ? <PageStatusNotice tone="error">{error}</PageStatusNotice> : null}
          {form.sensorId.trim() && form.sensorName.trim() ? (
            <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-50 px-5 py-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-sm font-bold text-[var(--kr-gov-text-primary)]">
                    {en ? "Open this draft in sensor settings" : "현재 초안을 센서 설정 화면에서 열기"}
                  </p>
                  <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">
                    {en
                      ? "Move to the edit screen with the current registration draft preserved in the query context."
                      : "현재 등록 초안을 유지한 상태로 센서 설정 화면으로 이동합니다."}
                  </p>
                </div>
                <a
                  className="inline-flex min-h-[44px] min-w-[180px] items-center justify-center rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white px-4 py-2 text-sm font-bold text-[var(--kr-gov-text-primary)] hover:border-[var(--kr-gov-blue)] hover:text-[var(--kr-gov-blue)]"
                  href={buildSensorEditDraftHref(form)}
                >
                  {en ? "Open Draft Settings" : "초안 설정 열기"}
                </a>
              </div>
            </div>
          ) : null}

          <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <article className="rounded-[var(--kr-gov-radius)] border border-blue-200 bg-[linear-gradient(135deg,rgba(239,246,255,0.96),rgba(255,255,255,0.98))] p-5 shadow-sm">
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[var(--kr-gov-blue)]">
                {en ? "Readiness" : "작성 진행률"}
              </p>
              <p className="mt-3 text-3xl font-black text-[var(--kr-gov-text-primary)]">{completionRatio}%</p>
              <p className="mt-2 text-sm text-[var(--kr-gov-text-secondary)]">
                {en ? "Required registration fields completed." : "필수 등록 항목 기준 작성 완료율입니다."}
              </p>
            </article>
            <article className="rounded-[var(--kr-gov-radius)] border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-emerald-700">
                {en ? "Collection Path" : "수집 경로"}
              </p>
              <p className="mt-3 text-xl font-black text-[var(--kr-gov-text-primary)]">{form.protocol}</p>
              <p className="mt-2 text-sm text-[var(--kr-gov-text-secondary)]">
                {(en ? "Sampling every " : "샘플링 주기 ") + `${form.samplingSeconds || "0"}${en ? " sec" : "초"}`}
              </p>
            </article>
            <article className="rounded-[var(--kr-gov-radius)] border border-amber-200 bg-amber-50 p-5 shadow-sm">
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-amber-700">
                {en ? "Escalation" : "알림 체계"}
              </p>
              <p className="mt-3 text-xl font-black text-[var(--kr-gov-text-primary)]">{form.notifyChannel}</p>
              <p className="mt-2 text-sm text-[var(--kr-gov-text-secondary)]">
                {(en ? "Calibration cycle: " : "보정 주기: ") + form.calibrationCycle}
              </p>
            </article>
          </section>

          <SectionCard
            data-help-id="sensor-add-basic-profile"
            title={en ? "Basic Sensor Profile" : "기본 센서 정보"}
            description={en ? "Define the identity and placement of the new sensor asset." : "신규 센서 자산의 기본 식별 정보와 설치 위치를 정의합니다."}
          >
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
              <Field label={en ? "Sensor Name" : "센서명"} required>
                <AdminInput value={form.sensorName} onChange={(event) => updateField("sensorName", event.target.value)} placeholder={en ? "Tank 02 gas concentration sensor" : "예: 저장탱크 02 가스농도 센서"} />
              </Field>
              <Field label={en ? "Sensor ID" : "센서 ID"} required>
                <AdminInput value={form.sensorId} onChange={(event) => updateField("sensorId", event.target.value.toUpperCase())} placeholder="SNSR-TK02-GAS-001" />
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
                <AdminInput value={form.zoneName} onChange={(event) => updateField("zoneName", event.target.value)} placeholder={en ? "Storage area A" : "예: 저장구역 A"} />
              </Field>
              <Field label={en ? "Installation Location" : "설치 위치"} required>
                <AdminInput value={form.installLocation} onChange={(event) => updateField("installLocation", event.target.value)} placeholder={en ? "Tank line 2 north valve" : "예: 2번 탱크 북측 밸브"} />
              </Field>
            </div>
          </SectionCard>

          <SectionCard
            data-help-id="sensor-add-policy"
            title={en ? "Collection And Alert Policy" : "수집 및 경보 정책"}
            description={en ? "Choose the data collection path and define warning thresholds for operational response." : "데이터 수집 경로와 운영 대응을 위한 경보 임계값을 설정합니다."}
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
                <AdminInput value={form.thresholdWarning} onChange={(event) => updateField("thresholdWarning", event.target.value)} placeholder={en ? "Example: 65 ppm" : "예: 65 ppm"} />
              </Field>
              <Field label={en ? "Critical Threshold" : "위험 임계값"} required>
                <AdminInput value={form.thresholdCritical} onChange={(event) => updateField("thresholdCritical", event.target.value)} placeholder={en ? "Example: 80 ppm" : "예: 80 ppm"} />
              </Field>
              <Field label={en ? "Calibration Cycle" : "보정 주기"}>
                <AdminSelect value={form.calibrationCycle} onChange={(event) => updateField("calibrationCycle", event.target.value)}>
                  <option value="WEEKLY">{en ? "Weekly" : "매주"}</option>
                  <option value="MONTHLY">{en ? "Monthly" : "매월"}</option>
                  <option value="QUARTERLY">{en ? "Quarterly" : "분기"}</option>
                  <option value="HALF_YEARLY">{en ? "Half-yearly" : "반기"}</option>
                </AdminSelect>
              </Field>
            </div>
          </SectionCard>

          <SectionCard
            data-help-id="sensor-add-ops-notes"
            title={en ? "Ownership And Ops Notes" : "담당 체계 및 운영 메모"}
            description={en ? "Set the responsible owner and leave handover notes for the monitoring team." : "책임 담당자와 모니터링팀 인수인계 메모를 함께 남깁니다."}
          >
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <Field label={en ? "Owner" : "담당자"} required>
                <AdminInput value={form.managerName} onChange={(event) => updateField("managerName", event.target.value)} placeholder={en ? "Operator name" : "담당자명"} />
              </Field>
              <Field label={en ? "Owner Contact" : "담당자 연락처"} required>
                <AdminInput value={form.managerContact} onChange={(event) => updateField("managerContact", event.target.value)} placeholder={en ? "010-0000-0000 / ops@carbonet.local" : "010-0000-0000 또는 이메일"} />
              </Field>
              <div className="md:col-span-2">
                <Field label={en ? "Operational Notes" : "운영 메모"}>
                  <AdminTextarea
                    className="min-h-[120px]"
                    value={form.description}
                    onChange={(event) => updateField("description", event.target.value)}
                    placeholder={en ? "Describe installation cautions, maintenance notes, and escalation context." : "설치 주의사항, 유지보수 메모, 장애 승격 기준 등을 입력하세요."}
                  />
                </Field>
              </div>
            </div>
          </SectionCard>

          <MemberActionBar
            eyebrow={en ? "Monitoring Setup" : "모니터링 설정"}
            title={en ? "Register sensor and connect downstream monitoring later" : "센서를 등록하고 이후 모니터링 연동으로 확장"}
            description={
              en
                ? "This screen currently validates and stages registration input. Wire the backend save endpoint next when sensor master storage is ready."
                : "현재 화면은 등록 입력 검증과 구성 초안을 담당합니다. 센서 마스터 저장소가 준비되면 저장 API만 연결하면 됩니다."
            }
            secondary={{ label: en ? "Reset" : "초기화", onClick: handleReset }}
            tertiary={{
              label: en ? "Back to Sensor List" : "센서 목록으로",
              onClick: () => navigate(buildLocalizedPath("/admin/monitoring/sensor_list", "/en/admin/monitoring/sensor_list"))
            }}
            primary={
              <button
                className="inline-flex min-w-[180px] items-center justify-center rounded-[var(--kr-gov-radius)] bg-[var(--kr-gov-blue)] px-6 py-4 text-sm font-bold text-white shadow-sm transition hover:brightness-110"
                type="submit"
              >
                {en ? "Validate Registration" : "등록 내용 검증"}
              </button>
            }
          />
        </AdminEditPageFrame>
      </form>
    </AdminPageShell>
  );
}
