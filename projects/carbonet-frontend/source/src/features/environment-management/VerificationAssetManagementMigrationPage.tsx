import { type ReactNode, useEffect, useMemo, useState } from "react";
import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { logGovernanceScope } from "../../app/policy/debug";
import {
  fetchVerificationAssetManagementPage,
  resolveVerificationAction,
  upsertVerificationAccount,
  upsertVerificationBaseline,
  upsertVerificationDataset
} from "../../lib/api/platform";
import { isEnglish } from "../../lib/navigation/runtime";
import { buildVerificationCenterPath } from "../../platform/routes/platformPaths";
import { AdminPageShell } from "../admin-entry/AdminPageShell";
import { CollectionResultPanel, GridToolbar, MemberButton, MemberLinkButton, PageStatusNotice, SummaryMetricCard } from "../admin-ui/common";
import { AdminWorkspacePageFrame } from "../admin-ui/pageFrames";

type ManagementPayload = {
  summary?: Record<string, unknown>;
  baselineRegistry?: Array<Record<string, unknown>>;
  managedVault?: {
    accounts?: Array<Record<string, unknown>>;
    datasets?: Array<Record<string, unknown>>;
  };
  actionQueue?: Array<Record<string, unknown>>;
};

function Field({
  label,
  children
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-2 text-sm font-medium text-[var(--kr-gov-text-primary)]">
      <span>{label}</span>
      {children}
    </label>
  );
}

function inputClassName() {
  return "w-full rounded-md border border-[var(--kr-gov-border)] bg-white px-3 py-2 text-sm text-[var(--kr-gov-text-primary)]";
}

const EMPTY_BASELINE = {
  pageId: "",
  routePath: "",
  baselineId: "",
  snapshotPath: "",
  owner: "",
  lastVerifiedAt: "",
  requiredScenarioIds: "",
  stale: false,
  profileId: "",
  datasetId: ""
};

const EMPTY_ACCOUNT = {
  profileId: "",
  role: "",
  status: "READY",
  expiresAt: "",
  resetOwner: "",
  allowedRoutes: ""
};

const EMPTY_DATASET = {
  datasetId: "",
  type: "",
  status: "READY",
  lastRefreshedAt: "",
  retentionPolicy: "30d",
  maskingPolicy: "FULL_MASK"
};

export function VerificationAssetManagementMigrationPage() {
  const en = isEnglish();
  const pageQuery = useAsyncValue<ManagementPayload>(() => fetchVerificationAssetManagementPage(), [], { initialValue: {} as ManagementPayload });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busyKey, setBusyKey] = useState("");
  const [baselineForm, setBaselineForm] = useState(EMPTY_BASELINE);
  const [accountForm, setAccountForm] = useState(EMPTY_ACCOUNT);
  const [datasetForm, setDatasetForm] = useState(EMPTY_DATASET);

  const payload = (pageQuery.value || {}) as ManagementPayload;
  const summary = (payload.summary || {}) as Record<string, unknown>;
  const baselineRegistry = Array.isArray(payload.baselineRegistry) ? payload.baselineRegistry : [];
  const accounts = Array.isArray(payload.managedVault?.accounts) ? payload.managedVault.accounts : [];
  const datasets = Array.isArray(payload.managedVault?.datasets) ? payload.managedVault.datasets : [];
  const actionQueue = Array.isArray(payload.actionQueue) ? payload.actionQueue : [];

  useEffect(() => {
    logGovernanceScope("PAGE", "verification-assets", {
      language: en ? "en" : "ko",
      baselineCount: baselineRegistry.length,
      accountCount: accounts.length,
      datasetCount: datasets.length,
      actionQueueCount: actionQueue.length
    });
  }, [actionQueue.length, accounts.length, baselineRegistry.length, datasets.length, en]);

  const staleBaselineCount = useMemo(() => Number(summary.staleBaselineCount || 0), [summary.staleBaselineCount]);

  async function reloadWithNotice(nextMessage: string) {
    setMessage(nextMessage);
    setError("");
    await pageQuery.reload();
  }

  async function handleBaselineSave() {
    try {
      setBusyKey("baseline");
      const response = await upsertVerificationBaseline(baselineForm);
      await reloadWithNotice(String(response.message || (en ? "Baseline saved." : "baseline을 저장했습니다.")));
      setBaselineForm(EMPTY_BASELINE);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : en ? "Failed to save baseline." : "baseline 저장에 실패했습니다.");
    } finally {
      setBusyKey("");
    }
  }

  async function handleAccountSave() {
    try {
      setBusyKey("account");
      const response = await upsertVerificationAccount(accountForm);
      await reloadWithNotice(String(response.message || (en ? "Test account saved." : "테스트 계정을 저장했습니다.")));
      setAccountForm(EMPTY_ACCOUNT);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : en ? "Failed to save test account." : "테스트 계정 저장에 실패했습니다.");
    } finally {
      setBusyKey("");
    }
  }

  async function handleDatasetSave() {
    try {
      setBusyKey("dataset");
      const response = await upsertVerificationDataset(datasetForm);
      await reloadWithNotice(String(response.message || (en ? "Dataset saved." : "데이터셋을 저장했습니다.")));
      setDatasetForm(EMPTY_DATASET);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : en ? "Failed to save dataset." : "데이터셋 저장에 실패했습니다.");
    } finally {
      setBusyKey("");
    }
  }

  async function handleResolveAction(actionId: string) {
    try {
      setBusyKey(actionId);
      const response = await resolveVerificationAction(actionId);
      await reloadWithNotice(String(response.message || (en ? "Action resolved." : "조치를 해제했습니다.")));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : en ? "Failed to resolve action." : "조치 해제에 실패했습니다.");
    } finally {
      setBusyKey("");
    }
  }

  return (
    <AdminPageShell
      title={en ? "Verification Asset Management" : "검증 자산 관리"}
      subtitle={en ? "Manage baseline backups, reusable test accounts, masked datasets, and the active action queue from one page." : "baseline 백업, 재사용 테스트 계정, 마스킹 데이터셋, 현재 action queue를 한 화면에서 관리합니다."}
      breadcrumbs={[
        { label: en ? "Verification Center" : "운영 검증 센터", href: buildVerificationCenterPath() },
        { label: en ? "Verification Asset Management" : "검증 자산 관리" }
      ]}
    >
      <AdminWorkspacePageFrame>
        {message ? <PageStatusNotice tone="success">{message}</PageStatusNotice> : null}
        {error || pageQuery.error ? <PageStatusNotice tone="error">{error || pageQuery.error}</PageStatusNotice> : null}
        <PageStatusNotice tone="warning">
          {en
            ? "This page writes directly to the local verification state file. Use it for governed local baselines and reusable smoke fixtures."
            : "이 페이지는 로컬 verification 상태 파일에 직접 기록합니다. 통제된 로컬 baseline과 재사용 smoke fixture 관리에 사용합니다."}
        </PageStatusNotice>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SummaryMetricCard title={en ? "Baselines" : "baseline"} value={String(summary.baselineRegistryCount || baselineRegistry.length)} />
          <SummaryMetricCard title={en ? "Test Accounts" : "테스트 계정"} value={String(accounts.length)} />
          <SummaryMetricCard title={en ? "Datasets" : "데이터셋"} value={String(datasets.length)} />
          <SummaryMetricCard title={en ? "Action Queue" : "조치 큐"} value={`${summary.actionQueueCount || actionQueue.length}${staleBaselineCount ? ` / stale ${staleBaselineCount}` : ""}`} />
        </section>

        <section className="grid gap-6 xl:grid-cols-3">
          <CollectionResultPanel
            title={en ? "Baseline registry" : "baseline 레지스트리"}
            description={en ? "Save per-page recovery anchors and scenario ids." : "페이지별 복구 anchor와 scenario id를 저장합니다."}
          >
            <div className="space-y-3">
              <Field label={en ? "Page id" : "페이지 ID"}>
                <input className={inputClassName()} onChange={(event) => setBaselineForm((current) => ({ ...current, pageId: event.target.value }))} value={baselineForm.pageId} />
              </Field>
              <Field label={en ? "Route path" : "경로"}>
                <input className={inputClassName()} onChange={(event) => setBaselineForm((current) => ({ ...current, routePath: event.target.value }))} value={baselineForm.routePath} />
              </Field>
              <Field label={en ? "Baseline id" : "baseline ID"}>
                <input className={inputClassName()} onChange={(event) => setBaselineForm((current) => ({ ...current, baselineId: event.target.value }))} value={baselineForm.baselineId} />
              </Field>
              <Field label={en ? "Snapshot path" : "snapshot 경로"}>
                <input className={inputClassName()} onChange={(event) => setBaselineForm((current) => ({ ...current, snapshotPath: event.target.value }))} value={baselineForm.snapshotPath} />
              </Field>
              <Field label={en ? "Owner" : "담당자"}>
                <input className={inputClassName()} onChange={(event) => setBaselineForm((current) => ({ ...current, owner: event.target.value }))} value={baselineForm.owner} />
              </Field>
              <Field label={en ? "Required scenarios" : "필수 scenario"}>
                <input className={inputClassName()} onChange={(event) => setBaselineForm((current) => ({ ...current, requiredScenarioIds: event.target.value }))} placeholder="ROUTE_HEAD,SMOKE_SAVE" value={baselineForm.requiredScenarioIds} />
              </Field>
              <Field label={en ? "Profile ID (Account)" : "프로필 ID (계정)"}>
                <input className={inputClassName()} onChange={(event) => setBaselineForm((current) => ({ ...current, profileId: event.target.value }))} value={baselineForm.profileId} />
              </Field>
              <Field label={en ? "Dataset ID" : "데이터셋 ID"}>
                <input className={inputClassName()} onChange={(event) => setBaselineForm((current) => ({ ...current, datasetId: event.target.value }))} value={baselineForm.datasetId} />
              </Field>
              <label className="flex items-center gap-2 text-sm">
                <input checked={baselineForm.stale} onChange={(event) => setBaselineForm((current) => ({ ...current, stale: event.target.checked }))} type="checkbox" />
                <span>{en ? "Mark as stale" : "stale로 표시"}</span>
              </label>
              <MemberButton disabled={busyKey === "baseline"} onClick={() => void handleBaselineSave()} variant="primary">{en ? "Save baseline" : "baseline 저장"}</MemberButton>
            </div>
          </CollectionResultPanel>

          <CollectionResultPanel
            title={en ? "Test account vault" : "테스트 계정 보관함"}
            description={en ? "Keep reusable accounts with expiry and allowed routes." : "만료일과 허용 경로가 있는 재사용 계정을 관리합니다."}
          >
            <div className="space-y-3">
              <Field label={en ? "Profile id" : "프로필 ID"}>
                <input className={inputClassName()} onChange={(event) => setAccountForm((current) => ({ ...current, profileId: event.target.value }))} value={accountForm.profileId} />
              </Field>
              <Field label={en ? "Role" : "역할"}>
                <input className={inputClassName()} onChange={(event) => setAccountForm((current) => ({ ...current, role: event.target.value }))} value={accountForm.role} />
              </Field>
              <Field label={en ? "Status" : "상태"}>
                <select className={inputClassName()} onChange={(event) => setAccountForm((current) => ({ ...current, status: event.target.value }))} value={accountForm.status}>
                  <option value="READY">READY</option>
                  <option value="EXPIRING_SOON">EXPIRING_SOON</option>
                  <option value="DISABLED">DISABLED</option>
                </select>
              </Field>
              <Field label={en ? "Expires at" : "만료일시"}>
                <input className={inputClassName()} onChange={(event) => setAccountForm((current) => ({ ...current, expiresAt: event.target.value }))} placeholder="2026-05-15T00:00:00+09:00" value={accountForm.expiresAt} />
              </Field>
              <Field label={en ? "Reset owner" : "재발급 담당"}>
                <input className={inputClassName()} onChange={(event) => setAccountForm((current) => ({ ...current, resetOwner: event.target.value }))} value={accountForm.resetOwner} />
              </Field>
              <Field label={en ? "Allowed routes" : "허용 경로"}>
                <input className={inputClassName()} onChange={(event) => setAccountForm((current) => ({ ...current, allowedRoutes: event.target.value }))} placeholder="/admin/system/verification-center,/admin/system/asset-inventory" value={accountForm.allowedRoutes} />
              </Field>
              <MemberButton disabled={busyKey === "account"} onClick={() => void handleAccountSave()} variant="primary">{en ? "Save account" : "계정 저장"}</MemberButton>
            </div>
          </CollectionResultPanel>

          <CollectionResultPanel
            title={en ? "Dataset vault" : "데이터셋 보관함"}
            description={en ? "Register masked fixtures with refresh and retention policy." : "갱신일과 보존 정책이 있는 마스킹 fixture를 등록합니다."}
          >
            <div className="space-y-3">
              <Field label={en ? "Dataset id" : "데이터셋 ID"}>
                <input className={inputClassName()} onChange={(event) => setDatasetForm((current) => ({ ...current, datasetId: event.target.value }))} value={datasetForm.datasetId} />
              </Field>
              <Field label={en ? "Type" : "유형"}>
                <input className={inputClassName()} onChange={(event) => setDatasetForm((current) => ({ ...current, type: event.target.value }))} value={datasetForm.type} />
              </Field>
              <Field label={en ? "Status" : "상태"}>
                <select className={inputClassName()} onChange={(event) => setDatasetForm((current) => ({ ...current, status: event.target.value }))} value={datasetForm.status}>
                  <option value="READY">READY</option>
                  <option value="STALE">STALE</option>
                  <option value="DISABLED">DISABLED</option>
                </select>
              </Field>
              <Field label={en ? "Last refreshed at" : "마지막 갱신일시"}>
                <input className={inputClassName()} onChange={(event) => setDatasetForm((current) => ({ ...current, lastRefreshedAt: event.target.value }))} placeholder="2026-04-15T09:00:00+09:00" value={datasetForm.lastRefreshedAt} />
              </Field>
              <Field label={en ? "Retention policy" : "보존 정책"}>
                <input className={inputClassName()} onChange={(event) => setDatasetForm((current) => ({ ...current, retentionPolicy: event.target.value }))} value={datasetForm.retentionPolicy} />
              </Field>
              <Field label={en ? "Masking policy" : "마스킹 정책"}>
                <input className={inputClassName()} onChange={(event) => setDatasetForm((current) => ({ ...current, maskingPolicy: event.target.value }))} value={datasetForm.maskingPolicy} />
              </Field>
              <MemberButton disabled={busyKey === "dataset"} onClick={() => void handleDatasetSave()} variant="primary">{en ? "Save dataset" : "데이터셋 저장"}</MemberButton>
            </div>
          </CollectionResultPanel>
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <section className="gov-card overflow-hidden">
            <GridToolbar
              title={en ? "Current baseline registry" : "현재 baseline 레지스트리"}
              meta={en ? "Newest rows appear first after save." : "저장 후 최신 항목이 먼저 표시됩니다."}
              actions={<MemberLinkButton href={buildVerificationCenterPath()} size="sm" variant="secondary">{en ? "Open center" : "센터 열기"}</MemberLinkButton>}
            />
            <div className="overflow-x-auto px-6 py-4">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--kr-gov-border-light)] text-left text-[var(--kr-gov-text-secondary)]">
                    <th className="px-2 py-2">pageId</th>
                    <th className="px-2 py-2">baselineId</th>
                    <th className="px-2 py-2">{en ? "Account" : "계정"}</th>
                    <th className="px-2 py-2">{en ? "Dataset" : "데이터셋"}</th>
                    <th className="px-2 py-2">{en ? "State" : "상태"}</th>
                  </tr>
                </thead>
                <tbody>
                  {baselineRegistry.map((item: Record<string, unknown>) => (
                    <tr className="border-b border-[var(--kr-gov-border-light)] align-top" key={String(item.baselineId)}>
                      <td className="px-2 py-2">{String(item.pageId || "-")}</td>
                      <td className="px-2 py-2">{String(item.baselineId || "-")}</td>
                      <td className="px-2 py-2 text-xs font-mono">{String(item.profileId || "-")}</td>
                      <td className="px-2 py-2 text-xs font-mono">{String(item.datasetId || "-")}</td>
                      <td className="px-2 py-2">{String(item.stale) === "true" ? "STALE" : "READY"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="gov-card overflow-hidden">
            <GridToolbar
              title={en ? "Open action queue" : "열린 조치 큐"}
              meta={en ? "Resolve local follow-up items after refresh or reissue." : "갱신이나 재발급 후 로컬 후속 조치를 해제합니다."}
            />
            <div className="space-y-3 px-6 py-4">
              {actionQueue.map((item: Record<string, unknown>) => (
                <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] p-4" key={String(item.actionId)}>
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-1">
                      <div className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{String(item.severity)} / {String(item.category)}</div>
                      <div className="font-semibold">{String(item.title)}</div>
                      <div className="text-sm text-[var(--kr-gov-text-secondary)]">{String(item.recommendedAction)}</div>
                    </div>
                    <MemberButton disabled={busyKey === String(item.actionId)} onClick={() => void handleResolveAction(String(item.actionId))} size="sm" variant="secondary">
                      {en ? "Resolve" : "해제"}
                    </MemberButton>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <section className="gov-card overflow-hidden">
            <GridToolbar title={en ? "Managed accounts" : "관리 계정"} />
            <div className="overflow-x-auto px-6 py-4">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--kr-gov-border-light)] text-left text-[var(--kr-gov-text-secondary)]">
                    <th className="px-2 py-2">profileId</th>
                    <th className="px-2 py-2">role</th>
                    <th className="px-2 py-2">status</th>
                    <th className="px-2 py-2">{en ? "Expires" : "만료"}</th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((item: Record<string, unknown>) => (
                    <tr className="border-b border-[var(--kr-gov-border-light)]" key={String(item.profileId)}>
                      <td className="px-2 py-2">{String(item.profileId || "-")}</td>
                      <td className="px-2 py-2">{String(item.role || "-")}</td>
                      <td className="px-2 py-2">{String(item.status || "-")}</td>
                      <td className="px-2 py-2">{String(item.expiresAt || "-")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="gov-card overflow-hidden">
            <GridToolbar title={en ? "Managed datasets" : "관리 데이터셋"} />
            <div className="overflow-x-auto px-6 py-4">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--kr-gov-border-light)] text-left text-[var(--kr-gov-text-secondary)]">
                    <th className="px-2 py-2">datasetId</th>
                    <th className="px-2 py-2">type</th>
                    <th className="px-2 py-2">status</th>
                    <th className="px-2 py-2">{en ? "Refreshed" : "갱신일"}</th>
                  </tr>
                </thead>
                <tbody>
                  {datasets.map((item: Record<string, unknown>) => (
                    <tr className="border-b border-[var(--kr-gov-border-light)]" key={String(item.datasetId)}>
                      <td className="px-2 py-2">{String(item.datasetId || "-")}</td>
                      <td className="px-2 py-2">{String(item.type || "-")}</td>
                      <td className="px-2 py-2">{String(item.status || "-")}</td>
                      <td className="px-2 py-2">{String(item.lastRefreshedAt || "-")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </section>
      </AdminWorkspacePageFrame>
    </AdminPageShell>
  );
}
