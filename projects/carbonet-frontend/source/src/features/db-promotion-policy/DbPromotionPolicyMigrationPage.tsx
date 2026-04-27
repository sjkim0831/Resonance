import { useEffect, useMemo, useState } from "react";
import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { logGovernanceScope } from "../../app/policy/debug";
import { fetchDbPromotionPolicyPage, saveDbPromotionPolicy } from "../../lib/api/ops";
import type { DbPromotionPolicyPagePayload } from "../../lib/api/opsTypes";
import { buildLocalizedPath, isEnglish } from "../../lib/navigation/runtime";
import { AdminPageShell } from "../admin-entry/AdminPageShell";
import { stringOf } from "../admin-system/adminSystemShared";
import { AdminInput, AdminSelect, AdminTextarea, CollectionResultPanel, GridToolbar, MemberButton, PageStatusNotice, SummaryMetricCard } from "../admin-ui/common";
import { AdminWorkspacePageFrame } from "../admin-ui/pageFrames";

function buildCommentPreview(form: Record<string, string>, en: boolean) {
  const tableName = stringOf(form, "tableName");
  const category = stringOf(form, "categoryLabel") || (en ? "review-needed" : "검토 필요");
  const policyLabel = stringOf(form, "policyLabel") || stringOf(form, "policyCode");
  const dmlPolicyLabel = stringOf(form, "dmlPolicyLabel");
  const ddlPolicyLabel = stringOf(form, "ddlPolicyLabel");
  const reason = stringOf(form, "policyReason");
  return en
    ? `Table ${tableName} is classified as ${category}. DML policy is ${dmlPolicyLabel || policyLabel}, while DDL stays ${ddlPolicyLabel}. Keep this table on ${policyLabel} unless an operator records a concrete override reason. ${reason ? `Current rationale: ${reason}` : "Add table-specific rationale before remote promotion."}`
    : `테이블 ${tableName} 은(는) ${category} 범주로 관리합니다. DML 정책은 ${dmlPolicyLabel || policyLabel}, DDL 해석은 ${ddlPolicyLabel} 기준으로 둡니다. 운영자는 구체적 우회 사유가 없는 한 이 테이블을 ${policyLabel} 기준으로 유지합니다. ${reason ? `현재 사유: ${reason}` : "원격 반영 전에는 테이블별 특수 사유를 반드시 남깁니다."}`;
}

export function DbPromotionPolicyMigrationPage() {
  const en = isEnglish();
  const pageState = useAsyncValue<DbPromotionPolicyPagePayload>(fetchDbPromotionPolicyPage, []);
  const page = pageState.value;
  const rows = (page?.dbPromotionPolicyRows || []) as Array<Record<string, string>>;
  const recentChanges = (page?.dbPromotionPolicyRecentChangeRows || []) as Array<Record<string, string>>;
  const guidance = (page?.dbPromotionPolicyGuidance || []) as Array<Record<string, string>>;
  const summary = (page?.dbPromotionPolicySummary || []) as Array<Record<string, string>>;
  const [selectedTable, setSelectedTable] = useState("");
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const selectedRow = useMemo(
    () => rows.find((row) => stringOf(row, "tableName") === selectedTable) || null,
    [rows, selectedTable]
  );
  const filteredRecentChanges = useMemo(
    () => recentChanges.filter((row) => stringOf(row, "targetTableName") === selectedTable).slice(0, 12),
    [recentChanges, selectedTable]
  );

  useEffect(() => {
    const preferredTable = stringOf(page as Record<string, unknown> | null, "dbPromotionPolicySelectedTable");
    const nextSelectedTable = preferredTable || selectedTable || stringOf(rows[0], "tableName");
    if (nextSelectedTable && nextSelectedTable !== selectedTable) {
      setSelectedTable(nextSelectedTable);
    }
    if (stringOf(page as Record<string, unknown> | null, "dbPromotionPolicyMessage")) {
      setMessage(stringOf(page as Record<string, unknown> | null, "dbPromotionPolicyMessage"));
    }
  }, [page, rows, selectedTable]);

  useEffect(() => {
    if (!selectedRow) {
      return;
    }
    setForm({
      tableName: stringOf(selectedRow, "tableName"),
      policyCode: stringOf(selectedRow, "policyCode") || "BLOCKED",
      changeTypesInput: stringOf(selectedRow, "changeTypesInput") || "INSERT, UPDATE, DELETE",
      maskingProfileCode: stringOf(selectedRow, "maskingProfileCode"),
      sqlRenderMode: stringOf(selectedRow, "sqlRenderMode"),
      activeYn: stringOf(selectedRow, "activeYn") || "Y",
      policyReason: stringOf(selectedRow, "policyReason"),
      categoryLabel: stringOf(selectedRow, "categoryLabel"),
      policyLabel: stringOf(selectedRow, "policyLabel"),
      dmlPolicyLabel: stringOf(selectedRow, "dmlPolicyLabel"),
      ddlPolicyLabel: stringOf(selectedRow, "ddlPolicyLabel")
    });
  }, [selectedRow]);

  logGovernanceScope("PAGE", "db-promotion-policy", {
    language: en ? "en" : "ko",
    tableCount: rows.length,
    selectedTable,
    recentChangeCount: recentChanges.length
  });

  async function handleSave() {
    setSaving(true);
    setMessage("");
    try {
      const payload = await saveDbPromotionPolicy(form);
      pageState.setValue(payload);
      setMessage(stringOf(payload as Record<string, unknown>, "dbPromotionPolicyMessage") || (en ? "Saved." : "저장했습니다."));
      setSelectedTable(stringOf(payload as Record<string, unknown>, "dbPromotionPolicySelectedTable") || form.tableName);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : (en ? "Failed to save policy." : "정책 저장에 실패했습니다."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminPageShell
      breadcrumbs={[
        { label: en ? "Home" : "홈", href: buildLocalizedPath("/admin/", "/en/admin/") },
        { label: en ? "System" : "시스템" },
        { label: en ? "DB Promotion Policy Catalog" : "DB 반영 정책 카탈로그" }
      ]}
      title={en ? "DB Promotion Policy Catalog" : "DB 반영 정책 카탈로그"}
      subtitle={en ? "Review table-level promotion policy, DML/DDL exception posture, and recent captured changes from one operator page." : "테이블별 반영 정책, DML/DDL 예외 해석, 최근 저장 추적 변경을 한 화면에서 관리합니다."}
    >
      <AdminWorkspacePageFrame>
        {pageState.error ? <PageStatusNotice tone="error">{pageState.error}</PageStatusNotice> : null}
        {message ? <PageStatusNotice tone="info">{message}</PageStatusNotice> : null}
        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {summary.map((card, index) => (
            <SummaryMetricCard key={`${stringOf(card, "title")}-${index}`} title={stringOf(card, "title")} value={stringOf(card, "value")} description={stringOf(card, "description")} />
          ))}
        </section>
        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <article className="gov-card overflow-hidden p-0" data-help-id="db-promotion-policy-table-list">
            <GridToolbar
              title={en ? "Table Policy Catalog" : "테이블 정책 카탈로그"}
              meta={en ? "Current inventory is based on policy rows plus recently captured tables." : "현재 인벤토리는 정책 행과 최근 변경 포착 테이블 기준입니다."}
              actions={<span className="text-sm text-[var(--kr-gov-text-secondary)]">{en ? "Total" : "총"} <strong>{rows.length}</strong>{en ? " tables" : "개 테이블"}</span>}
            />
            <div className="max-h-[36rem] overflow-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="gov-table-header">
                    <th className="px-4 py-3">{en ? "Table" : "테이블"}</th>
                    <th className="px-4 py-3">{en ? "Category" : "분류"}</th>
                    <th className="px-4 py-3">{en ? "Policy" : "정책"}</th>
                    <th className="px-4 py-3">DML</th>
                    <th className="px-4 py-3">DDL</th>
                    <th className="px-4 py-3">{en ? "Recent" : "최근"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.map((row) => {
                    const active = stringOf(row, "tableName") === selectedTable;
                    return (
                      <tr
                        key={stringOf(row, "tableName")}
                        className={active ? "bg-[rgba(15,61,145,0.06)]" : "cursor-pointer hover:bg-slate-50"}
                        onClick={() => setSelectedTable(stringOf(row, "tableName"))}
                      >
                        <td className="px-4 py-3 font-mono text-[13px] font-bold">{stringOf(row, "tableName")}</td>
                        <td className="px-4 py-3">{stringOf(row, "categoryLabel")}</td>
                        <td className="px-4 py-3">{stringOf(row, "policyLabel")}</td>
                        <td className="px-4 py-3">{stringOf(row, "dmlPolicyLabel")}</td>
                        <td className="px-4 py-3">{stringOf(row, "ddlPolicyLabel")}</td>
                        <td className="px-4 py-3">{stringOf(row, "recentChangeCount")}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </article>
          <article className="gov-card">
            <div className="mb-4">
              <h3 className="text-lg font-bold">{en ? "Policy Editor" : "정책 편집"}</h3>
              <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">
                {en ? "Use this editor for table-level DML exception posture. DDL should still remain review-first unless there is a stronger downstream guardrail." : "이 편집기는 테이블 단위 DML 예외 기준을 정리하는 용도입니다. DDL은 더 강한 하위 가드레일이 있기 전까지 검토 우선을 유지합니다."}
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4">
              <label className="flex flex-col gap-2">
                <span className="text-sm font-bold text-[var(--kr-gov-text-primary)]">{en ? "Table Name" : "테이블명"}</span>
                <AdminInput value={stringOf(form, "tableName")} onChange={(event) => setForm((current) => ({ ...current, tableName: event.target.value.toUpperCase() }))} placeholder="COMTNMENUINFO" />
              </label>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <label className="flex flex-col gap-2">
                  <span className="text-sm font-bold text-[var(--kr-gov-text-primary)]">{en ? "Promotion Policy" : "반영 정책"}</span>
                  <AdminSelect value={stringOf(form, "policyCode") || "BLOCKED"} onChange={(event) => setForm((current) => ({ ...current, policyCode: event.target.value }))}>
                    <option value="BLOCKED">{en ? "Blocked" : "차단"}</option>
                    <option value="MANUAL_APPROVAL">{en ? "Manual approval" : "승인 필요"}</option>
                    <option value="AUTO_QUEUE">{en ? "Auto queue" : "자동 큐"}</option>
                  </AdminSelect>
                </label>
                <label className="flex flex-col gap-2">
                  <span className="text-sm font-bold text-[var(--kr-gov-text-primary)]">{en ? "Active" : "활성"}</span>
                  <AdminSelect value={stringOf(form, "activeYn") || "Y"} onChange={(event) => setForm((current) => ({ ...current, activeYn: event.target.value }))}>
                    <option value="Y">{en ? "Yes" : "예"}</option>
                    <option value="N">{en ? "No" : "아니오"}</option>
                  </AdminSelect>
                </label>
              </div>
              <label className="flex flex-col gap-2">
                <span className="text-sm font-bold text-[var(--kr-gov-text-primary)]">{en ? "Tracked Change Types" : "추적 change type"}</span>
                <AdminInput value={stringOf(form, "changeTypesInput")} onChange={(event) => setForm((current) => ({ ...current, changeTypesInput: event.target.value }))} placeholder="INSERT, UPDATE, DELETE, ALTER" />
              </label>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <label className="flex flex-col gap-2">
                  <span className="text-sm font-bold text-[var(--kr-gov-text-primary)]">{en ? "Masking / Data Profile" : "마스킹 / 데이터 프로파일"}</span>
                  <AdminInput value={stringOf(form, "maskingProfileCode")} onChange={(event) => setForm((current) => ({ ...current, maskingProfileCode: event.target.value.toUpperCase() }))} placeholder="STANDARD_ADMIN" />
                </label>
                <label className="flex flex-col gap-2">
                  <span className="text-sm font-bold text-[var(--kr-gov-text-primary)]">{en ? "SQL Render Mode" : "SQL 렌더 모드"}</span>
                  <AdminInput value={stringOf(form, "sqlRenderMode")} onChange={(event) => setForm((current) => ({ ...current, sqlRenderMode: event.target.value.toUpperCase() }))} placeholder="UPSERT_DELETE_BY_KEY" />
                </label>
              </div>
              <label className="flex flex-col gap-2">
                <span className="text-sm font-bold text-[var(--kr-gov-text-primary)]">{en ? "Policy Reason" : "정책 사유"}</span>
                <AdminTextarea value={stringOf(form, "policyReason")} onChange={(event) => setForm((current) => ({ ...current, policyReason: event.target.value }))} placeholder={en ? "Explain why this table is blocked, manual, or auto-queue eligible." : "이 테이블이 차단/승인 필요/자동 큐 대상인 이유를 적으세요."} />
              </label>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <MemberButton type="button" variant="primary" onClick={() => void handleSave()} disabled={saving || !stringOf(form, "tableName")}>
                {saving ? (en ? "Saving..." : "저장 중...") : (en ? "Save Policy" : "정책 저장")}
              </MemberButton>
              <MemberButton type="button" variant="secondary" onClick={() => selectedRow && setForm({
                tableName: stringOf(selectedRow, "tableName"),
                policyCode: stringOf(selectedRow, "policyCode"),
                changeTypesInput: stringOf(selectedRow, "changeTypesInput"),
                maskingProfileCode: stringOf(selectedRow, "maskingProfileCode"),
                sqlRenderMode: stringOf(selectedRow, "sqlRenderMode"),
                activeYn: stringOf(selectedRow, "activeYn"),
                policyReason: stringOf(selectedRow, "policyReason"),
                categoryLabel: stringOf(selectedRow, "categoryLabel"),
                policyLabel: stringOf(selectedRow, "policyLabel"),
                dmlPolicyLabel: stringOf(selectedRow, "dmlPolicyLabel"),
                ddlPolicyLabel: stringOf(selectedRow, "ddlPolicyLabel")
              })} disabled={!selectedRow}>
                {en ? "Reset To Selected Row" : "선택 행 기준 복원"}
              </MemberButton>
            </div>
          </article>
        </section>
        <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_1fr]">
          <CollectionResultPanel
            data-help-id="db-promotion-policy-comment"
            icon="comment"
            title={en ? "Generated Operator Comment" : "운영 코멘트 자동 생성"}
            description={en ? "Use this as the baseline comment for ticket, queue override note, or PR description." : "티켓, 큐 우회 사유, PR 설명의 기본 문안으로 사용할 수 있습니다."}
          >
            <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-50 px-4 py-4 text-sm leading-7 text-[var(--kr-gov-text-secondary)]">
              {buildCommentPreview(form, en)}
            </div>
          </CollectionResultPanel>
          <article className="gov-card overflow-hidden p-0" data-help-id="db-promotion-policy-recent-changes">
            <GridToolbar
              title={en ? "Recent Captured Changes" : "최근 저장 추적 변경"}
              meta={selectedTable ? (en ? `Recent captured rows for ${selectedTable}.` : `${selectedTable} 기준 최근 추적 변경입니다.`) : (en ? "Select a table first." : "먼저 테이블을 선택하세요.")}
            />
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="gov-table-header">
                    <th className="px-4 py-3">{en ? "Captured At" : "추적 시각"}</th>
                    <th className="px-4 py-3">{en ? "Type" : "유형"}</th>
                    <th className="px-4 py-3">{en ? "Decision" : "결정"}</th>
                    <th className="px-4 py-3">{en ? "Actor" : "작업자"}</th>
                    <th className="px-4 py-3">{en ? "Summary" : "요약"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredRecentChanges.length === 0 ? (
                    <tr><td className="px-4 py-6 text-center text-[var(--kr-gov-text-secondary)]" colSpan={5}>{en ? "No recent captured changes for this table." : "이 테이블 기준 최근 추적 변경이 없습니다."}</td></tr>
                  ) : filteredRecentChanges.map((row, index) => (
                    <tr key={`${stringOf(row, "capturedAt")}-${index}`}>
                      <td className="px-4 py-3">{stringOf(row, "capturedAt")}</td>
                      <td className="px-4 py-3">{stringOf(row, "changeType")}</td>
                      <td className="px-4 py-3">{stringOf(row, "queueDecisionCode") || stringOf(row, "promotionPolicyCode")}</td>
                      <td className="px-4 py-3">{stringOf(row, "actorId")}</td>
                      <td className="px-4 py-3">{stringOf(row, "changeSummary")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
        </section>
        <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          {guidance.map((item) => (
            <CollectionResultPanel key={stringOf(item, "title")} icon="rule" title={stringOf(item, "title")} description={stringOf(item, "body")}>
              <p className="text-sm leading-6 text-[var(--kr-gov-text-secondary)]">{stringOf(item, "body")}</p>
            </CollectionResultPanel>
          ))}
        </section>
      </AdminWorkspacePageFrame>
    </AdminPageShell>
  );
}
