import { useEffect, useMemo, useState } from "react";
import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { logGovernanceScope } from "../../app/policy/debug";
import { fetchExternalKeysPage, mutateExternalKey } from "../../lib/api/ops";
import type { ExternalKeysPagePayload } from "../../lib/api/opsTypes";
import { buildLocalizedPath, isEnglish } from "../../lib/navigation/runtime";
import { stringOf } from "../admin-system/adminSystemShared";
import { AdminPageShell } from "../admin-entry/AdminPageShell";
import { CollectionResultPanel, GridToolbar, PageStatusNotice, SummaryMetricCard } from "../admin-ui/common";
import { AdminWorkspacePageFrame } from "../admin-ui/pageFrames";
import { AdminInput, AdminSelect, MemberButton } from "../member/common";

type ExternalKeyCloseoutItem = {
  label: string;
  value: string;
  ready: boolean;
  detail: string;
};

function readyBadgeClass(ready: boolean) {
  return ready ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700";
}

function badgeClass(value: string) {
  const upper = value.toUpperCase();
  if (upper.includes("EXPIRED") || upper.includes("ROTATE_NOW") || upper.includes("CRITICAL")) {
    return "bg-red-100 text-red-700";
  }
  if (upper.includes("SOON") || upper.includes("REVIEW") || upper.includes("MANUAL")) {
    return "bg-amber-100 text-amber-700";
  }
  if (upper.includes("HEALTHY") || upper.includes("ACTIVE") || upper.includes("AUTO")) {
    return "bg-emerald-100 text-emerald-700";
  }
  return "bg-slate-100 text-slate-700";
}

function looksMasked(value: string) {
  const normalized = value.trim();
  return Boolean(normalized) && (normalized.includes("*") || normalized.toUpperCase().includes("MASKED"));
}

function ExternalKeyCloseoutPanel({
  actionItems,
  items,
  en
}: {
  actionItems: Array<{ label: string; description: string }>;
  items: ExternalKeyCloseoutItem[];
  en: boolean;
}) {
  return (
    <section className="gov-card" data-help-id="external-keys-closeout-gate">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--kr-gov-blue)]">{en ? "Route Closeout Gate" : "라우트 완료 게이트"}</p>
          <h2 className="mt-1 text-xl font-black text-[var(--kr-gov-text-primary)]">{en ? "Credential Key Execution Readiness" : "외부 인증키 실행 준비 상태"}</h2>
          <p className="mt-2 max-w-4xl text-sm text-[var(--kr-gov-text-secondary)]">
            {en
              ? "This route can safely inspect masked credential metadata today. Issue, rotate, revoke, and audit mutations remain blocked until backend action contracts and feature codes are wired."
              : "현재 이 화면은 마스킹된 인증키 메타데이터 점검은 가능합니다. 발급, 회전, 폐기, 감사 변경 이력은 백엔드 실행 계약과 기능 코드가 연결될 때까지 차단 상태로 표시합니다."}
          </p>
        </div>
        <span className="inline-flex w-fit rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-700">
          {en ? "PARTIAL" : "부분 완료"}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-4">
        {items.map((item) => (
          <article key={item.label} className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-black text-[var(--kr-gov-text-primary)]">{item.label}</h3>
              <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.08em] ${readyBadgeClass(item.ready)}`}>
                {item.ready ? (en ? "READY" : "준비됨") : (en ? "BLOCKED" : "차단")}
              </span>
            </div>
            <p className="mt-2 text-lg font-black text-[var(--kr-gov-text-primary)]">{item.value}</p>
            <p className="mt-1 text-xs leading-5 text-[var(--kr-gov-text-secondary)]">{item.detail}</p>
          </article>
        ))}
      </div>

      <div className="mt-4 rounded-[var(--kr-gov-radius)] border border-dashed border-amber-300 bg-amber-50 p-4" data-help-id="external-keys-action-contract">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h3 className="text-sm font-black text-amber-900">{en ? "Action Contract Preview" : "실행 계약 미리보기"}</h3>
            <p className="mt-1 text-sm text-amber-900">
              {en
                ? "Actions are intentionally disabled so operators cannot assume credential mutations are audited before the backend runner exists."
                : "백엔드 실행기와 감사 기록이 준비되기 전에는 운영자가 인증키 변경이 처리된 것으로 오인하지 않도록 액션을 의도적으로 비활성화했습니다."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {actionItems.map((item) => (
              <button
                key={item.label}
                className="gov-btn gov-btn-outline opacity-60"
                disabled
                title={item.description}
                type="button"
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export function ExternalKeysMigrationPage() {
  const en = isEnglish();
  const pageState = useAsyncValue<ExternalKeysPagePayload>(fetchExternalKeysPage, [], {});
  const page = pageState.value;
  const summary = useMemo(() => ((page?.externalKeysSummary || []) as Array<Record<string, string>>), [page]);
  const rows = useMemo(() => ((page?.externalKeyRows || []) as Array<Record<string, string>>), [page]);
  const rotationRows = useMemo(() => ((page?.externalKeyRotationRows || []) as Array<Record<string, string>>), [page]);
  const quickLinks = useMemo(() => ((page?.externalKeyQuickLinks || []) as Array<Record<string, string>>), [page]);
  const guidance = useMemo(() => ((page?.externalKeyGuidance || []) as Array<Record<string, string>>), [page]);
  const [keyword, setKeyword] = useState("");
  const [authMethod, setAuthMethod] = useState("ALL");
  const [rotationStatus, setRotationStatus] = useState("ALL");

  const [mutatingKey, setMutatingKey] = useState<string | null>(null);
  const [mutationMessage, setMutationMessage] = useState("");
  const [mutationError, setMutationError] = useState("");

  const handleKeyMutation = async (action: "issue" | "rotate" | "revoke", row: Record<string, unknown>) => {
    const connectionId = stringOf(row, "connectionId");
    const credentialLabel = stringOf(row, "credentialLabel");
    
    if (!window.confirm(en 
      ? `Are you sure you want to ${action} the key for ${connectionId} / ${credentialLabel}?\nThis action will be audited and may affect downstream systems.`
      : `정말로 ${connectionId} / ${credentialLabel} 의 키를 ${action === "issue" ? "발급" : action === "rotate" ? "교체(회전)" : "폐기"}하시겠습니까?\n이 작업은 감사 로그에 기록되며 하위 시스템에 영향을 줄 수 있습니다.`
    )) return;

    setMutatingKey(`${connectionId}-${credentialLabel}`);
    setMutationMessage("");
    setMutationError("");
    try {
      const response = await mutateExternalKey(action, {
        connectionId,
        credentialLabel,
        reason: "Admin forced mutation from governed console",
        approver: "Admin"
      });
      setMutationMessage(response.message || (en ? `Successfully performed ${action} action.` : `성공적으로 ${action} 작업을 수행했습니다.`));
      await pageState.reload();
    } catch (err) {
      setMutationError(err instanceof Error ? err.message : (en ? `Failed to ${action} key.` : `키 ${action} 작업에 실패했습니다.`));
    } finally {
      setMutatingKey(null);
    }
  };

  const filteredRows = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesKeyword = !normalizedKeyword || [
        stringOf(row, "connectionId"),
        stringOf(row, "connectionName"),
        stringOf(row, "partnerName"),
        stringOf(row, "ownerName"),
        stringOf(row, "credentialLabel")
      ].join(" ").toLowerCase().includes(normalizedKeyword);
      const matchesAuthMethod = authMethod === "ALL" || stringOf(row, "authMethod").toUpperCase() === authMethod;
      const matchesRotationStatus = rotationStatus === "ALL" || stringOf(row, "rotationStatus").toUpperCase() === rotationStatus;
      return matchesKeyword && matchesAuthMethod && matchesRotationStatus;
    });
  }, [authMethod, keyword, rotationStatus, rows]);

  const urgentRows = useMemo(
    () => rows.filter((row) => ["ROTATE_NOW", "EXPIRED"].includes(stringOf(row, "rotationStatus").toUpperCase())),
    [rows]
  );

  const closeoutItems = useMemo<ExternalKeyCloseoutItem[]>(() => {
    const maskedRows = rows.filter((row) => looksMasked(stringOf(row, "maskedReference")));
    const scopedRows = rows.filter((row) => Boolean(stringOf(row, "scopeSummary") && stringOf(row, "targetRoute")));
    const expiryRows = rows.filter((row) => Boolean(stringOf(row, "expiresAt") && stringOf(row, "rotationStatus")));
    return [
      {
        label: en ? "Secret Masking" : "비밀값 마스킹",
        value: `${maskedRows.length}/${rows.length}`,
        ready: rows.length > 0 && maskedRows.length === rows.length,
        detail: en ? "Inventory renders masked references only." : "인벤토리는 마스킹된 참조값만 렌더링합니다."
      },
      {
        label: en ? "Partner Scope" : "파트너 범위",
        value: `${scopedRows.length}/${rows.length}`,
        ready: rows.length > 0 && scopedRows.length === rows.length,
        detail: en ? "Each row links to the owning connection and scope summary." : "각 항목은 소유 연계와 권한 범위 요약을 함께 표시합니다."
      },
      {
        label: en ? "Expiry Policy" : "만료 정책",
        value: `${expiryRows.length}/${rows.length}`,
        ready: rows.length > 0 && expiryRows.length === rows.length,
        detail: en ? "Expiry date and rotation status are visible before action." : "실행 전 만료일과 교체 상태를 확인할 수 있습니다."
      },
      {
        label: en ? "Mutation Audit" : "변경 감사",
        value: en ? "API pending" : "API 대기",
        ready: false,
        detail: en ? "Issue, rotate, and revoke require backend action endpoints and secret-safe audit events." : "발급, 회전, 폐기는 백엔드 액션 엔드포인트와 비밀값 안전 감사 이벤트가 필요합니다."
      }
    ];
  }, [en, rows]);

  const actionItems = useMemo(
    () => [
      {
        label: en ? "Issue Key" : "키 발급",
        description: en ? "Requires issue action API and feature code." : "발급 액션 API와 기능 코드가 필요합니다."
      },
      {
        label: en ? "Rotate Selected" : "선택 키 회전",
        description: en ? "Requires rotation runner, owner approval, and audit evidence." : "회전 실행기, 담당자 승인, 감사 증적이 필요합니다."
      },
      {
        label: en ? "Revoke Selected" : "선택 키 폐기",
        description: en ? "Requires revoke API, downstream cutover check, and rollback policy." : "폐기 API, 하위 시스템 전환 확인, 롤백 정책이 필요합니다."
      },
      {
        label: en ? "Export Audit Inventory" : "감사용 인벤토리 내보내기",
        description: en ? "Requires secret-safe export contract." : "비밀값 안전 내보내기 계약이 필요합니다."
      }
    ],
    [en]
  );

  const authMethodRows = useMemo(() => {
    const totals = new Map<string, { count: number; urgent: number; manual: number }>();
    rows.forEach((row) => {
      const auth = stringOf(row, "authMethod") || "UNKNOWN";
      const current = totals.get(auth) || { count: 0, urgent: 0, manual: 0 };
      current.count += 1;
      if (["ROTATE_NOW", "EXPIRED"].includes(stringOf(row, "rotationStatus").toUpperCase())) current.urgent += 1;
      if (stringOf(row, "rotationPolicy").toUpperCase() === "MANUAL") current.manual += 1;
      totals.set(auth, current);
    });
    return Array.from(totals.entries())
      .map(([authMethodValue, stats]) => ({
        authMethod: authMethodValue,
        connectionCount: String(stats.count),
        urgentCount: String(stats.urgent),
        manualCount: String(stats.manual)
      }))
      .sort((left, right) => Number(right.urgentCount) - Number(left.urgentCount) || Number(right.connectionCount) - Number(left.connectionCount));
  }, [rows]);

  useEffect(() => {
    logGovernanceScope("PAGE", "external-keys", {
      language: en ? "en" : "ko",
      totalCount: rows.length,
      filteredCount: filteredRows.length,
      authMethod,
      rotationStatus
    });
  }, [authMethod, en, filteredRows.length, rotationStatus, rows.length]);

  return (
    <AdminPageShell
      breadcrumbs={[
        { label: en ? "Home" : "홈", href: buildLocalizedPath("/admin/", "/en/admin/") },
        { label: en ? "External Integration" : "외부 연계" },
        { label: en ? "Credential Keys" : "외부 인증키 관리" }
      ]}
      title={en ? "Credential Keys" : "외부 인증키 관리"}
      subtitle={en ? "Track external integration credential health, rotation timing, and owner handoff without exposing secret values." : "외부 연계 비밀값은 노출하지 않고 인증키 상태, 교체 시점, 운영 담당 인계 체계를 함께 점검합니다."}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <a className="gov-btn gov-btn-outline" href={buildLocalizedPath("/admin/external/connection_list", "/en/admin/external/connection_list")}>
            {en ? "Connection Registry" : "외부 연계 목록"}
          </a>
          <a className="gov-btn" href={buildLocalizedPath("/admin/external/sync", "/en/admin/external/sync")}>
            {en ? "Sync Execution" : "동기화 실행"}
          </a>
        </div>
      }
      loading={pageState.loading && !page}
      loadingLabel={en ? "Loading external keys..." : "외부 인증키 현황을 불러오는 중입니다."}
    >
      <AdminWorkspacePageFrame>
        {pageState.error ? <PageStatusNotice tone="error">{pageState.error}</PageStatusNotice> : null}
        {mutationError ? <PageStatusNotice tone="error">{mutationError}</PageStatusNotice> : null}
        {mutationMessage ? <PageStatusNotice tone="success">{mutationMessage}</PageStatusNotice> : null}
        {urgentRows.length > 0 ? (
          <PageStatusNotice tone="warning">
            {en
              ? `${urgentRows.length} credential records need immediate owner review or rotation before the next downstream window.`
              : `${urgentRows.length}건의 인증키가 즉시 검토 또는 교체 대상입니다. 다음 하위 시스템 점검 창 이전에 담당자 확인이 필요합니다.`}
          </PageStatusNotice>
        ) : null}

        <ExternalKeyCloseoutPanel actionItems={actionItems} en={en} items={closeoutItems} />

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4" data-help-id="external-keys-summary">
          {summary.map((item, index) => (
            <SummaryMetricCard
              key={`${stringOf(item, "title")}-${index}`}
              title={stringOf(item, "title")}
              value={stringOf(item, "value")}
              description={stringOf(item, "description")}
            />
          ))}
        </section>

        <CollectionResultPanel
          data-help-id="external-keys-filters"
          title={en ? "Credential Filters" : "인증키 조회 조건"}
          description={en ? "Filter by connection, auth method, or rotation urgency before opening the owning connection flow." : "운영 연결 화면으로 이동하기 전에 연계, 인증 방식, 교체 긴급도 기준으로 범위를 좁힙니다."}
          icon="vpn_key"
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4 xl:w-[68rem]">
            <div>
              <label className="mb-1 block text-sm font-bold" htmlFor="externalKeyKeyword">{en ? "Keyword" : "검색어"}</label>
              <AdminInput id="externalKeyKeyword" placeholder={en ? "Connection, owner, credential" : "연계명, 담당자, 인증키"} value={keyword} onChange={(event) => setKeyword(event.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-bold" htmlFor="externalKeyAuthMethod">{en ? "Auth Method" : "인증 방식"}</label>
              <AdminSelect id="externalKeyAuthMethod" value={authMethod} onChange={(event) => setAuthMethod(event.target.value)}>
                <option value="ALL">{en ? "All" : "전체"}</option>
                <option value="API_KEY">API_KEY</option>
                <option value="OAUTH2">OAUTH2</option>
                <option value="BASIC">BASIC</option>
                <option value="MUTUAL_TLS">MUTUAL_TLS</option>
                <option value="OBSERVED">OBSERVED</option>
              </AdminSelect>
            </div>
            <div>
              <label className="mb-1 block text-sm font-bold" htmlFor="externalKeyRotationStatus">{en ? "Rotation Status" : "교체 상태"}</label>
              <AdminSelect id="externalKeyRotationStatus" value={rotationStatus} onChange={(event) => setRotationStatus(event.target.value)}>
                <option value="ALL">{en ? "All" : "전체"}</option>
                <option value="HEALTHY">HEALTHY</option>
                <option value="ROTATE_SOON">ROTATE_SOON</option>
                <option value="ROTATE_NOW">ROTATE_NOW</option>
                <option value="EXPIRED">EXPIRED</option>
              </AdminSelect>
            </div>
            <div className="flex items-end">
              <button className="gov-btn gov-btn-outline w-full" type="button" onClick={() => { setKeyword(""); setAuthMethod("ALL"); setRotationStatus("ALL"); }}>
                {en ? "Reset Filters" : "검색 조건 초기화"}
              </button>
            </div>
          </div>
        </CollectionResultPanel>

        <section className="gov-card overflow-hidden p-0" data-help-id="external-keys-inventory">
          <GridToolbar
            actions={<p className="text-sm text-[var(--kr-gov-text-secondary)]">{en ? `Visible ${filteredRows.length} of ${rows.length}` : `전체 ${rows.length}건 중 ${filteredRows.length}건 표시`}</p>}
            meta={(en ? "Refreshed at " : "갱신 시각 ") + stringOf(page as Record<string, unknown>, "refreshedAt")}
            title={en ? "Credential Inventory" : "인증키 인벤토리"}
          />
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs font-black uppercase tracking-[0.08em] text-[var(--kr-gov-text-secondary)]">
                <tr>
                  <th className="px-4 py-3">{en ? "Connection" : "연계"}</th>
                  <th className="px-4 py-3">{en ? "Credential" : "인증키"}</th>
                  <th className="px-4 py-3">{en ? "Auth" : "방식"}</th>
                  <th className="px-4 py-3">{en ? "Scope" : "권한 범위"}</th>
                  <th className="px-4 py-3">{en ? "Last Rotated" : "최근 교체"}</th>
                  <th className="px-4 py-3">{en ? "Expires" : "만료 예정"}</th>
                  <th className="px-4 py-3">{en ? "Rotation" : "교체 상태"}</th>
                  <th className="px-4 py-3">{en ? "Owner" : "담당"}</th>
                  <th className="px-4 py-3 text-right">{en ? "Actions" : "관리 조치"}</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row, index) => {
                  const keyId = `${stringOf(row, "connectionId")}-${stringOf(row, "credentialLabel")}`;
                  const isMutating = mutatingKey === keyId;
                  return (
                  <tr key={`${stringOf(row, "connectionId")}-${index}`} className="border-t border-[var(--kr-gov-border-light)]">
                    <td className="px-4 py-3">
                      <a className="font-bold text-[var(--kr-gov-blue)] underline-offset-2 hover:underline" href={stringOf(row, "targetRoute")}>
                        {stringOf(row, "connectionName")}
                      </a>
                      <p className="mt-1 text-xs text-[var(--kr-gov-text-secondary)]">{stringOf(row, "connectionId")} / {stringOf(row, "partnerName")}</p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-bold">{stringOf(row, "credentialLabel")}</div>
                      <div className="mt-1 font-mono text-xs text-[var(--kr-gov-text-secondary)]">{stringOf(row, "maskedReference")}</div>
                    </td>
                    <td className="px-4 py-3">{stringOf(row, "authMethod")}</td>
                    <td className="px-4 py-3">{stringOf(row, "scopeSummary")}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{stringOf(row, "lastRotatedAt")}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{stringOf(row, "expiresAt")}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-black ${badgeClass(stringOf(row, "rotationStatus"))}`}>{stringOf(row, "rotationStatus")}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div>{stringOf(row, "ownerName") || "-"}</div>
                      <div className="mt-1 text-xs text-[var(--kr-gov-text-secondary)]">{stringOf(row, "ownerContact") || "-"}</div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <MemberButton
                          size="sm"
                          variant="secondary"
                          disabled={isMutating || mutatingKey !== null}
                          onClick={() => handleKeyMutation("rotate", row)}
                        >
                          {en ? "Rotate" : "교체(회전)"}
                        </MemberButton>
                        <MemberButton
                          size="sm"
                          variant="secondary"
                          disabled={isMutating || mutatingKey !== null}
                          onClick={() => handleKeyMutation("revoke", row)}
                        >
                          {en ? "Revoke" : "폐기"}
                        </MemberButton>
                      </div>
                    </td>
                  </tr>
                  );
                })}
                {filteredRows.length === 0 ? (
                  <tr className="border-t border-[var(--kr-gov-border-light)]">
                    <td className="px-4 py-8 text-center text-[var(--kr-gov-text-secondary)]" colSpan={9}>
                      {en ? "No external credentials match the current filters." : "현재 조건에 맞는 외부 인증키가 없습니다."}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.15fr,1fr]">
          <article className="gov-card overflow-hidden p-0" data-help-id="external-keys-rotation-queue">
            <GridToolbar meta={en ? "Urgent rows are sorted first to keep rotation handoff visible." : "긴급 항목을 위로 올려 교체 인계 우선순위를 바로 확인할 수 있게 정렬했습니다."} title={en ? "Rotation Queue" : "교체 큐"} />
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="gov-table-header">
                    <th className="px-4 py-3">{en ? "Connection" : "연계"}</th>
                    <th className="px-4 py-3">{en ? "Rotation Window" : "교체 일정"}</th>
                    <th className="px-4 py-3">{en ? "Policy" : "정책"}</th>
                    <th className="px-4 py-3">{en ? "Reason" : "사유"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rotationRows.map((row, index) => (
                    <tr key={`${stringOf(row, "connectionId")}-${index}`}>
                      <td className="px-4 py-3">
                        <a className="font-bold text-[var(--kr-gov-blue)] underline-offset-2 hover:underline" href={stringOf(row, "targetRoute")}>
                          {stringOf(row, "connectionName")}
                        </a>
                        <p className="mt-1 text-xs text-[var(--kr-gov-text-secondary)]">{stringOf(row, "credentialLabel")}</p>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">{stringOf(row, "rotationWindow")}</td>
                      <td className="px-4 py-3"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-black ${badgeClass(stringOf(row, "rotationPolicy"))}`}>{stringOf(row, "rotationPolicy")}</span></td>
                      <td className="px-4 py-3">{stringOf(row, "reason")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>

          <div className="space-y-4">
            <CollectionResultPanel data-help-id="external-keys-auth-breakdown" title={en ? "Auth Method Breakdown" : "인증 방식 분해"} description={en ? "Review where urgent and manual rotation load is concentrated before assigning owners." : "담당자 배정 전에 긴급 교체와 수동 교체 부담이 어느 인증 방식에 몰려 있는지 먼저 확인합니다."} icon="rule">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="gov-table-header">
                      <th className="px-4 py-3">{en ? "Auth Method" : "인증 방식"}</th>
                      <th className="px-4 py-3">{en ? "Connections" : "연계 수"}</th>
                      <th className="px-4 py-3">{en ? "Urgent" : "긴급"}</th>
                      <th className="px-4 py-3">{en ? "Manual" : "수동"}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {authMethodRows.map((row, index) => (
                      <tr key={`${row.authMethod}-${index}`}>
                        <td className="px-4 py-3 font-bold">{row.authMethod}</td>
                        <td className="px-4 py-3">{row.connectionCount}</td>
                        <td className="px-4 py-3">{row.urgentCount}</td>
                        <td className="px-4 py-3">{row.manualCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CollectionResultPanel>

            <CollectionResultPanel data-help-id="external-keys-quick-links" title={en ? "Quick Links" : "바로가기"} description={en ? "Move into owning connection, whitelist, or observability pages without exposing secrets." : "비밀값 노출 없이 연결 관리, 화이트리스트, 추적 화면으로 바로 이동합니다."} icon="link">
              <div className="grid grid-cols-1 gap-3">
                {quickLinks.map((item, index) => (
                  <a key={`${stringOf(item, "label")}-${index}`} className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] px-4 py-3 text-sm font-bold text-[var(--kr-gov-blue)] hover:border-[var(--kr-gov-blue)]" href={stringOf(item, "targetRoute", "href")}>
                    {stringOf(item, "label", "title")}
                  </a>
                ))}
              </div>
            </CollectionResultPanel>

            <CollectionResultPanel data-help-id="external-keys-guidance" title={en ? "Operating Guidance" : "운영 가이드"} description={en ? "Use the same control baseline for rotation, expiry, and incident review." : "교체, 만료, 장애 점검에 동일한 통제 기준을 적용할 수 있도록 정리했습니다."} icon="fact_check">
              <div className="space-y-3">
                {guidance.map((item, index) => (
                  <article key={`${stringOf(item, "title")}-${index}`} className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.08em] ${badgeClass(stringOf(item, "tone"))}`}>{stringOf(item, "tone") || "INFO"}</span>
                      <h3 className="text-sm font-black text-[var(--kr-gov-text-primary)]">{stringOf(item, "title")}</h3>
                    </div>
                    <p className="mt-2 text-sm text-[var(--kr-gov-text-secondary)]">{stringOf(item, "body", "description")}</p>
                  </article>
                ))}
              </div>
            </CollectionResultPanel>
          </div>
        </section>
      </AdminWorkspacePageFrame>
    </AdminPageShell>
  );
}
