import { useEffect, useState } from "react";
import { logGovernanceScope } from "../../app/policy/debug";
import { CanView } from "../../components/access/CanView";
import { PermissionButton } from "../../components/access/CanUse";
import { buildLocalizedPath, getSearchParam } from "../../lib/navigation/runtime";
import { fetchAdminPermissionPage } from "../../lib/api/adminMember";
import { saveAdminPermission } from "../../lib/api/adminActions";
import { fetchFrontendSession } from "../../lib/api/adminShell";
import type { FrontendSession } from "../../lib/api/adminShellTypes";
import type { AdminPermissionPagePayload } from "../../lib/api/memberTypes";
import { AdminPageShell } from "../admin-entry/AdminPageShell";
import { AdminCheckbox, AdminSelect, PageStatusNotice, SummaryMetricCard, WarningPanel, getMemberButtonClassName } from "../admin-ui/common";
import { ADMIN_BUTTON_LABELS } from "../admin-ui/labels";
import { GridToolbar, MemberActionBar } from "../admin-ui/common";
import { AdminWorkspacePageFrame } from "../admin-ui/pageFrames";
import { MemberStateCard } from "../member/sections";

function text(page: AdminPermissionPagePayload | null, ko: string, en: string) {
  return page?.isEn ? en : ko;
}

function resolveInitialEmplyrId() {
  if (typeof window === "undefined") return "webmaster";
  return getSearchParam("emplyrId") || "webmaster";
}

export function AdminPermissionMigrationPage() {
  const initialEmplyrId = resolveInitialEmplyrId();
  const initialUpdated = getSearchParam("updated");
  const initialMode = getSearchParam("mode") || "edit";
  const [session, setSession] = useState<FrontendSession | null>(null);
  const [page, setPage] = useState<AdminPermissionPagePayload | null>(null);
  const [authorCode, setAuthorCode] = useState("");
  const [featureCodes, setFeatureCodes] = useState<string[]>([]);
  const [error, setError] = useState(() => getSearchParam("errorMessage"));
  const [message, setMessage] = useState("");

  async function load(target: string) {
    const [sessionPayload, pagePayload] = await Promise.all([
      session ? Promise.resolve(session) : fetchFrontendSession(),
      fetchAdminPermissionPage(target, { updated: initialUpdated, mode: initialMode })
    ]);
    setSession(sessionPayload);
    setPage(pagePayload);
    setAuthorCode(String(pagePayload.permissionSelectedAuthorCode || ""));
    setFeatureCodes((pagePayload.permissionEffectiveFeatureCodes as string[]) || []);
  }

  useEffect(() => {
    load(initialEmplyrId).catch((err: Error) => setError(err.message));
  }, []);

  function toggleFeature(code: string) {
    setFeatureCodes((current) => current.includes(code) ? current.filter((item) => item !== code) : [...current, code]);
  }

  const selectedAuthorName = String(page?.permissionSelectedAuthorName || "-");
  const featureCount = Number(page?.permissionFeatureCount || featureCodes.length);
  const pageCount = Number(page?.permissionPageCount || page?.permissionFeatureSections?.length || 0);
  const addedFeatureCodes = new Set((page?.permissionAddedFeatureCodes as string[] | undefined) || []);
  const removedFeatureCodes = new Set((page?.permissionRemovedFeatureCodes as string[] | undefined) || []);
  const baseFeatureCodes = new Set((page?.permissionBaseFeatureCodes as string[] | undefined) || []);
  const readOnly = Boolean(page?.adminAccountReadOnly);
  const validationErrors = (page?.adminPermissionErrors as string[] | undefined) || [];

  useEffect(() => {
    if (!page) {
      return;
    }
    logGovernanceScope("PAGE", "admin-permission", {
      route: window.location.pathname,
      emplyrId: page.adminPermissionTarget?.emplyrId || initialEmplyrId,
      authorCode,
      featureCount: featureCodes.length,
      canView: !!page.canViewAdminPermissionEdit,
      canSave: !!page.canUseAdminPermissionSave,
      readOnly
    });
    logGovernanceScope("COMPONENT", "admin-permission-features", {
      component: "admin-permission-features",
      selectedAuthorName,
      pageCount,
      featureCount
    });
  }, [authorCode, featureCodes.length, initialEmplyrId, page, pageCount, readOnly, selectedAuthorName]);

  async function handleSave() {
    if (!session || !page?.adminPermissionTarget) return;
    logGovernanceScope("ACTION", "admin-permission-save", {
      emplyrId: page.adminPermissionTarget.emplyrId,
      authorCode,
      featureCount: featureCodes.length
    });
    setError("");
    setMessage("");
    try {
      await saveAdminPermission(session, { emplyrId: page.adminPermissionTarget.emplyrId, authorCode, featureCodes });
      setMessage("관리자 권한을 저장했습니다.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장 실패");
    }
  }

  return (
    <AdminPageShell
      breadcrumbs={[
        { label: text(page, "홈", "Home"), href: buildLocalizedPath("/admin/", "/en/admin/") },
        { label: text(page, "회원·권한 관리", "Member / Authority Management") },
        { label: text(page, "관리자 사용자 추가", "Administrator Account") }
      ]}
      subtitle={text(
        page,
        "관리자 계정 정보와 권한, 소속 정보를 확인하고 권한 예외를 조정합니다.",
        "Review administrator account data, authority, and affiliation, then adjust permission overrides."
      )}
      title={text(page, "관리자 사용자 추가", "Administrator Account")}
    >
      {page?.adminPermissionError || error ? <PageStatusNotice tone="error">{String(page?.adminPermissionError || error)}</PageStatusNotice> : null}
      {validationErrors.length > 0 ? (
        <WarningPanel title={text(page, "입력값을 확인해 주세요.", "Please check the input values.")}>
          <ul className="list-disc pl-5 space-y-1">
            {validationErrors.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}
          </ul>
        </WarningPanel>
      ) : null}
      {page?.adminPermissionUpdated ? <PageStatusNotice tone="success">{text(page, "관리자 권한이 저장되었습니다.", "Administrator permissions have been saved.")}</PageStatusNotice> : null}
      {message ? <PageStatusNotice tone="success">{message}</PageStatusNotice> : null}
      {!!page && !page?.canViewAdminPermissionEdit ? (
        <MemberStateCard description={text(page, "편집 대상 관리자를 다시 조회하거나 현재 권한 범위를 확인해 주세요.", "Look up an administrator again or review the current permission scope.")} icon="lock" title={text(page, "권한이 없습니다.", "Permission denied.")} tone="warning" />
      ) : null}
      <CanView allowed={!!page?.canViewAdminPermissionEdit} fallback={null}>
        <AdminWorkspacePageFrame>
        <section className="grid grid-cols-1 gap-3 xl:grid-cols-4">
          <SummaryMetricCard title={text(page, "선택 권한 롤", "Selected role")} value={selectedAuthorName} description={text(page, "현재 기준 권한", "Current base authority")} />
          <SummaryMetricCard title={text(page, "최종 권한 수", "Effective features")} value={featureCount} description={text(page, "관리자별 예외 반영", "Overrides applied")} />
          <SummaryMetricCard title={text(page, "대상 메뉴 수", "Target menus")} value={pageCount} description={text(page, "권한 섹션 기준", "Permission sections")} />
          <SummaryMetricCard title={text(page, "편집 상태", "Edit status")} value={readOnly ? text(page, "상세 모드", "Detail mode") : text(page, "편집 가능", "Editable")} description={readOnly ? text(page, "저장 비활성", "Save disabled") : text(page, "저장 가능", "Save enabled")} />
        </section>
        <section className="border border-[var(--kr-gov-border-light)] rounded-[var(--kr-gov-radius)] bg-white shadow-sm mb-6" data-help-id="admin-permission-summary">
          <GridToolbar
            actions={<span className="material-symbols-outlined text-[var(--kr-gov-blue)]">admin_panel_settings</span>}
            meta={text(page, "현재 관리자 계정과 롤 기준 권한, 개별 예외 권한을 함께 관리합니다.", "Manage the current admin account together with role-based permissions and account-specific overrides.")}
            title={text(page, "관리자 계정 요약", "Administrator Account Summary")}
          />
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-gray-50 p-4">
              <p><span className="font-bold">관리자 ID:</span> {page?.adminPermissionTarget?.emplyrId || "-"}</p>
              <p className="mt-1"><span className="font-bold">이름:</span> {page?.adminPermissionTarget?.userNm || "-"}</p>
              <p className="mt-1"><span className="font-bold">이메일:</span> {page?.adminPermissionTarget?.emailAdres || "-"}</p>
            </div>
            <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-gray-50 p-4">
              <p><span className="font-bold">상태:</span> {String(page?.adminPermissionStatusLabel || "-")}</p>
              <p className="mt-1"><span className="font-bold">가입일:</span> {String(page?.adminPermissionJoinedAt || "-")}</p>
              <p className="mt-1"><span className="font-bold">기관 ID:</span> {page?.adminPermissionTarget?.insttId || "-"}</p>
            </div>
          </div>
        </section>
        <section className="border border-[var(--kr-gov-border-light)] rounded-[var(--kr-gov-radius)] bg-white shadow-sm" data-help-id="admin-permission-features">
          <GridToolbar
            actions={<span className="material-symbols-outlined text-[var(--kr-gov-blue)]">shield</span>}
            meta={text(page, "관리자 롤을 기준으로 체크를 맞춘 뒤, 계정별 추가 허용 또는 제외 권한을 직접 조정합니다.", "Align the baseline to the administrator role, then adjust account-specific additions or removals directly.")}
            title={text(page, "권한 롤 및 개별 권한", "Role and Individual Permissions")}
          />
          <div className="p-6 space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="block">
                  <span className="block text-sm font-bold text-[var(--kr-gov-text-primary)] mb-2">{text(page, "기준 권한 롤", "Base Role")} <span className="text-red-500">*</span></span>
                  <AdminSelect disabled={!page?.canUseAdminPermissionSave || readOnly} value={authorCode} onChange={(e) => setAuthorCode(e.target.value)}>
                    <option value="">{text(page, "권한 롤 선택", "Select a role")}</option>
                    {((page as Record<string, unknown> | null)?.permissionAuthorGroupSections as Array<Record<string, unknown>> | undefined)?.length ? (
                      (((page as Record<string, unknown> | null)?.permissionAuthorGroupSections as Array<Record<string, unknown>> | undefined) || []).map((section, sectionIndex) => (
                        <optgroup key={`${String(section.sectionLabel || "section")}-${sectionIndex}`} label={String(section.sectionLabel || "")}>
                          {((section.groups as Array<{ authorCode: string; authorNm: string }> | undefined) || []).map((group) => (
                            <option key={group.authorCode} value={group.authorCode}>{group.authorNm} ({group.authorCode})</option>
                          ))}
                        </optgroup>
                      ))
                    ) : (
                      (page?.permissionAuthorGroups || []).map((group) => <option key={group.authorCode} value={group.authorCode}>{group.authorNm} ({group.authorCode})</option>)
                    )}
                  </AdminSelect>
                </label>
              </div>
              <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-gray-50 p-4 text-sm">
                <p><span className="font-bold">선택 롤:</span> {selectedAuthorName}</p>
                <p className="mt-1"><span className="font-bold">최종 권한 수:</span> {featureCount}</p>
                <p className="mt-1"><span className="font-bold">대상 메뉴 수:</span> {pageCount}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="inline-flex items-center rounded-full px-3 py-1 font-bold bg-slate-100 text-slate-700">{text(page, "기본 롤 권한", "Base role permission")}</span>
              <span className="inline-flex items-center rounded-full px-3 py-1 font-bold bg-emerald-100 text-emerald-700">{text(page, "관리자별 추가", "Admin-specific add")}</span>
              <span className="inline-flex items-center rounded-full px-3 py-1 font-bold bg-red-100 text-red-700">{text(page, "관리자별 제외", "Admin-specific remove")}</span>
            </div>
            <div className="space-y-4">
              {(page?.permissionFeatureSections || []).map((section) => (
                <section className="rounded-[var(--kr-gov-radius)] border border-slate-200" key={section.menuCode}>
                  <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
                    <div>
                      <h4 className="text-sm font-bold text-[var(--kr-gov-text-primary)]">{section.menuNm || section.menuNmEn || section.menuCode}</h4>
                      <p className="mt-1 text-xs text-slate-500">{section.menuUrl || text(page, "연결 URL 없음", "No linked URL")}</p>
                    </div>
                    <span className="text-xs font-bold text-slate-500">{section.features.length}{text(page, "개 기능", " features")}</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4">
                    {section.features.map((feature) => (
                      <label className="flex items-start gap-3 rounded-[var(--kr-gov-radius)] border border-slate-200 bg-white px-4 py-3" key={feature.featureCode}>
                        <AdminCheckbox className="mt-1 h-4 w-4 border-gray-300" disabled={!page?.canUseAdminPermissionSave || readOnly} checked={featureCodes.includes(feature.featureCode)} onChange={() => toggleFeature(feature.featureCode)} />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-bold text-[var(--kr-gov-text-primary)]">{feature.featureNm || feature.featureCode}</span>
                            {addedFeatureCodes.has(feature.featureCode) ? <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-bold bg-emerald-100 text-emerald-700">{text(page, "추가", "Added")}</span> : null}
                            {removedFeatureCodes.has(feature.featureCode) ? <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-bold bg-red-100 text-red-700">{text(page, "제외", "Removed")}</span> : null}
                            {baseFeatureCodes.has(feature.featureCode) && !removedFeatureCodes.has(feature.featureCode) ? <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-bold bg-slate-100 text-slate-700">{text(page, "기본", "Base")}</span> : null}
                          </div>
                          <p className="mt-1 text-xs text-slate-500">{feature.featureCode}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </div>
        </section>
        <MemberActionBar
          dataHelpId="admin-permission-actions"
          eyebrow={text(page, "권한 변경", "Permission Update")}
          title={text(page, "관리자 권한 저장", "Save Administrator Permissions")}
          description={text(
            page,
            "기준 권한 롤과 개별 예외 권한을 검토한 뒤 저장합니다. 목록으로 돌아가 다시 대상을 선택할 수 있습니다.",
            "Review the base role and per-account overrides, then save. You can return to the list to choose another administrator."
          )}
          primary={(
            <PermissionButton
              allowed={!!page?.canUseAdminPermissionSave && !readOnly}
              className={`${getMemberButtonClassName({ variant: "primary", size: "lg" })} w-full sm:w-auto sm:min-w-[220px] justify-center whitespace-nowrap`}
              onClick={handleSave}
              reason={readOnly ? text(page, "상세 모드에서는 저장할 수 없습니다.", "Save is unavailable in detail mode.") : text(page, "권한 범위 안의 관리자만 저장할 수 있습니다.", "Only authorized company administrators can save administrator permissions.")}
              type="button"
            >
              {readOnly ? text(page, "상세 모드", "Detail mode") : text(page, "권한 저장", "Save permissions")}
            </PermissionButton>
          )}
          secondary={{ href: buildLocalizedPath("/admin/member/admin_list", "/en/admin/member/admin_list"), label: text(page, ADMIN_BUTTON_LABELS.list, "Back to list") }}
        />
        </AdminWorkspacePageFrame>
      </CanView>
    </AdminPageShell>
  );
}
