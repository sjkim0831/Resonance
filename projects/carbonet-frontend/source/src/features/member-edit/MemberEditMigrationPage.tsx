import { useEffect, useMemo, useRef, useState } from "react";
import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { useFrontendSession } from "../../app/hooks/useFrontendSession";
import { logGovernanceScope } from "../../app/policy/debug";
import { CanView } from "../../components/access/CanView";
import { readBootstrappedMemberEditPageData } from "../../lib/api/bootstrap";
import { fetchMemberEditPage } from "../../lib/api/adminMember";
import { saveMemberEdit } from "../../lib/api/adminActions";
import type { MemberEditPagePayload } from "../../lib/api/memberTypes";
import { buildLocalizedPath, getSearchParam } from "../../lib/navigation/runtime";
import { AdminPageShell } from "../admin-entry/AdminPageShell";
import { MemberActionBar, MemberLinkButton, MemberPermissionButton, MEMBER_BUTTON_LABELS, PageStatusNotice } from "../member/common";
import { AdminEditPageFrame } from "../admin-ui/pageFrames";
import { MemberStateCard } from "../member/sections";
import { MemberEditMainSections, MemberEditSummarySection, MemberEditFormState } from "./memberEditSections";

function text(page: MemberEditPagePayload | null, ko: string, en: string) {
  return page?.isEn ? en : ko;
}

function resolveInitialMemberId() {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams(window.location.search);
  return params.get("memberId") || "";
}

export function MemberEditMigrationPage() {
  const initialMemberId = resolveInitialMemberId();
  const initialUpdated = getSearchParam("updated");
  const bootstrappedPage = readBootstrappedMemberEditPageData();
  const memberIdInput = initialMemberId;
  const [isSaving, setIsSaving] = useState(false);
  const [featureCodes, setFeatureCodes] = useState<string[]>((bootstrappedPage?.permissionEffectiveFeatureCodes as string[] | undefined) || []);
  const [form, setForm] = useState<MemberEditFormState>({
    memberId: initialMemberId,
    applcntNm: "",
    applcntEmailAdres: "",
    phoneNumber: "",
    entrprsSeCode: "",
    entrprsMberSttus: "",
    authorCode: "",
    zip: "",
    adres: "",
    detailAdres: "",
    marketingYn: "N",
    deptNm: ""
  });
  const [actionError, setActionError] = useState(() => getSearchParam("errorMessage"));
  const [message, setMessage] = useState("");
  const didInitializeRoleSync = useRef(false);
  const sessionState = useFrontendSession();
  const pageState = useAsyncValue<MemberEditPagePayload>(
    () => fetchMemberEditPage(memberIdInput, { updated: initialUpdated }),
    [],
    {
      enabled: Boolean(memberIdInput.trim()),
      initialValue: bootstrappedPage,
      skipInitialLoad: Boolean(bootstrappedPage),
      onSuccess(pagePayload) {
        didInitializeRoleSync.current = false;
        const member = pagePayload.member;
        setForm({
          memberId: memberIdInput,
          applcntNm: String(member?.applcntNm || ""),
          applcntEmailAdres: String(member?.applcntEmailAdres || ""),
          phoneNumber: String(pagePayload.phoneNumber || ""),
          entrprsSeCode: String((pagePayload as Record<string, unknown>).memberTypeCode || ""),
          entrprsMberSttus: String((pagePayload as Record<string, unknown>).memberStatusCode || ""),
          authorCode: String(pagePayload.permissionSelectedAuthorCode || ""),
          zip: String(member?.zip || ""),
          adres: String(member?.adres || ""),
          detailAdres: String(member?.detailAdres || ""),
          marketingYn: String(member?.marketingYn || "N"),
          deptNm: String(member?.deptNm || "")
        });
        setFeatureCodes((pagePayload.permissionEffectiveFeatureCodes as string[]) || []);
      }
    }
  );
  const page = pageState.value;
  const error = actionError || sessionState.error || pageState.error;
  const payload = (page || {}) as Record<string, unknown>;
  const roleFeatureCodesByAuthorCode = useMemo(
    () => ((payload.permissionRoleFeatureCodesByAuthorCode as Record<string, string[]> | undefined) || {}),
    [payload.permissionRoleFeatureCodesByAuthorCode]
  );
  const dynamicBaseFeatureCodes = useMemo(
    () => new Set(roleFeatureCodesByAuthorCode[form.authorCode] || []),
    [form.authorCode, roleFeatureCodesByAuthorCode]
  );
  const dynamicAddedFeatureCodes = useMemo(
    () => featureCodes.filter((code) => !dynamicBaseFeatureCodes.has(code)),
    [dynamicBaseFeatureCodes, featureCodes]
  );
  const dynamicRemovedFeatureCodes = useMemo(
    () => Array.from(dynamicBaseFeatureCodes).filter((code) => !featureCodes.includes(code)),
    [dynamicBaseFeatureCodes, featureCodes]
  );
  const assignedRoleProfile = (payload.assignedRoleProfile as Record<string, unknown> | undefined) || {};
  const roleProfileVisible = String(assignedRoleProfile.memberEditVisibleYn || "Y") !== "N";
  const profilePriorityWorks = roleProfileVisible ? ((assignedRoleProfile.priorityWorks as string[] | undefined) || []) : [];
  const accessScopes = profilePriorityWorks.length > 0 ? profilePriorityWorks : ((payload.accessScopes as string[] | undefined) || []);
  const memberEvidenceFiles = (payload.memberEvidenceFiles as Array<Record<string, unknown>> | undefined) || [];
  const businessRoleLabel = String((roleProfileVisible ? assignedRoleProfile.displayTitle : "") || payload.businessRoleLabel || "-");
  const membershipTypeLabel = String(payload.membershipTypeLabel || "-");
  const statusLabel = String(payload.statusLabel || "-");
  const memberDocumentStatusLabel = String(payload.memberDocumentStatusLabel || "-");
  const institutionStatusLabel = String(payload.institutionStatusLabel || "-");
  const documentStatusLabel = String(payload.documentStatusLabel || "-");
  const institutionInsttId = String(payload.institutionInsttId || "");
  const permissionFeatureCount = Number(payload.permissionFeatureCount || featureCodes.length || 0);
  const permissionPageCount = useMemo(
    () => (page?.permissionFeatureSections || []).filter((section) =>
      section.features.some((feature) => featureCodes.includes(feature.featureCode))
    ).length,
    [featureCodes, page?.permissionFeatureSections]
  );
  const permissionAuthorGroups = page?.permissionAuthorGroups || [];
  const permissionSelectedAuthorName = String(
    permissionAuthorGroups.find((group) => group.authorCode === form.authorCode)?.authorNm
      || payload.permissionSelectedAuthorName
      || "-"
  );
  const validationErrors = (payload.member_editErrors as string[] | undefined) || [];
  const businessRoleDescription = String(
    (roleProfileVisible ? assignedRoleProfile.description : "")
      || text(page, "회원 유형에 따라 연결되는 핵심 업무를 요약합니다.", "Summarizes the core work linked to the selected member type.")
  );

  const canView = !!page?.canViewMemberEdit;
  const canUse = !!page?.canUseMemberSave;
  const hasMember = !!page?.member;
  const currentUserInsttId = String(page?.currentUserInsttId || "");
  const targetMemberInsttId = String(page?.targetMemberInsttId || "");
  const companyScopedAccess = !!page?.canManageOwnCompany && !page?.canManageAllCompanies;

  useEffect(() => {
    if (!page || !sessionState.value) {
      return;
    }
    logGovernanceScope("PAGE", "member-edit", {
      route: window.location.pathname,
      actorUserId: sessionState.value.userId || "",
      actorAuthorCode: sessionState.value.authorCode || "",
      actorInsttId: sessionState.value.insttId || "",
      canManageAllCompanies: !!page.canManageAllCompanies,
      canManageOwnCompany: !!page.canManageOwnCompany,
      pageScopeMode: String(page.memberManagementScopeMode || ""),
      targetMemberId: memberIdInput,
      targetInsttId: targetMemberInsttId,
      targetMemberType: String(page.targetMemberType || "")
    });
    logGovernanceScope("COMPONENT", "member-edit-permissions", {
      component: "member-edit-permissions",
      allowed: canView && hasMember,
      selectedAuthorCode: form.authorCode,
      effectiveFeatureCount: featureCodes.length,
      permissionPageCount
    });
  }, [
    canView,
    featureCodes.length,
    form.authorCode,
    hasMember,
    memberIdInput,
    page,
    permissionPageCount,
    sessionState.value,
    targetMemberInsttId
  ]);

  function toggleFeature(code: string) {
    setFeatureCodes((current) => current.includes(code) ? current.filter((item) => item !== code) : [...current, code]);
  }

  useEffect(() => {
    if (!form.authorCode) {
      return;
    }
    if (!didInitializeRoleSync.current) {
      didInitializeRoleSync.current = true;
      return;
    }
    setFeatureCodes(roleFeatureCodesByAuthorCode[form.authorCode] || []);
  }, [form.authorCode, roleFeatureCodesByAuthorCode]);

  async function handleSave() {
    const session = sessionState.value;
    if (isSaving) {
      return;
    }
    if (!session) {
      setActionError("세션 정보가 없습니다.");
      return;
    }
    setActionError("");
    setMessage("");
    setIsSaving(true);
    logGovernanceScope("ACTION", "member-edit-save", {
      targetMemberId: form.memberId,
      actorInsttId: session.insttId || "",
      targetInsttId: targetMemberInsttId,
      targetMemberType: form.entrprsSeCode,
      selectedAuthorCode: form.authorCode,
      featureCodeCount: featureCodes.length
    });
    try {
      const result = await saveMemberEdit(session, { ...form, featureCodes });
      await pageState.reload();
      setMessage(`${result.memberId} 회원 정보를 저장했습니다.`);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "저장 중 오류가 발생했습니다.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <AdminPageShell
      breadcrumbs={[
        { label: text(page, "홈", "Home"), href: buildLocalizedPath("/admin/", "/en/admin/") },
        { label: text(page, "회원 관리", "Member Management"), href: buildLocalizedPath("/admin/member/list", "/en/admin/member/list") },
        { label: text(page, "회원 정보 수정", "Edit Member Information") }
      ]}
      subtitle={text(
        page,
        "회원 계정의 신청자 정보, 연락처, 상태를 수정합니다. 회원사 정보는 하단에서 참조용으로만 확인합니다.",
        "Edit applicant information, contact details, and status for the member account. Company data below is reference-only."
      )}
      title={text(page, "회원 정보 수정", "Edit Member Information")}
    >
      {page?.member_editError || error ? (
        <PageStatusNotice tone="error">{String(page?.member_editError || error)}</PageStatusNotice>
      ) : null}
      {validationErrors.length > 0 ? (
        <PageStatusNotice tone="warning">
          <p className="font-bold mb-1">{text(page, "입력값을 확인해 주세요.", "Please check the input values.")}</p>
          <ul className="list-disc pl-5 space-y-1">
            {validationErrors.map((item, index) => (
              <li key={`${item}-${index}`}>{item}</li>
            ))}
          </ul>
        </PageStatusNotice>
      ) : null}
      {page?.member_editUpdated ? (
        <PageStatusNotice tone="success">
          {text(page, "회원 정보가 저장되었습니다.", "Member information has been saved.")}
        </PageStatusNotice>
      ) : null}
      {companyScopedAccess ? (
        <PageStatusNotice tone="warning">
          {text(
            page,
            `본인 회원사 범위로만 수정할 수 있습니다. 현재 기관 ID ${currentUserInsttId || "-"} / 대상 기관 ID ${targetMemberInsttId || "-"}`,
            `Edits are limited to your own company scope. Current institution ID ${currentUserInsttId || "-"} / target institution ID ${targetMemberInsttId || "-"}`
          )}
        </PageStatusNotice>
      ) : null}
      {message ? <PageStatusNotice tone="success">{message}</PageStatusNotice> : null}
      {!memberIdInput.trim() ? (
        <MemberStateCard
          actions={<MemberLinkButton href={buildLocalizedPath("/admin/member/list", "/en/admin/member/list")} icon="arrow_back" variant="secondary">{text(page, MEMBER_BUTTON_LABELS.list, "List")}</MemberLinkButton>}
          description={text(page, "전달된 회원 ID 또는 조회 결과를 확인해 주세요.", "Check the supplied member ID or lookup result.")}
          icon="person_search"
          title={text(page, "회원 정보를 찾을 수 없습니다.", "Member not found.")}
        />
      ) : null}
      {memberIdInput.trim() && !pageState.loading && !hasMember ? (
        <MemberStateCard
          actions={<MemberLinkButton href={buildLocalizedPath("/admin/member/list", "/en/admin/member/list")} icon="arrow_back" variant="secondary">{text(page, MEMBER_BUTTON_LABELS.list, "List")}</MemberLinkButton>}
          description={`${text(page, "요청한 회원 ID:", "Requested member ID:")} ${memberIdInput}`}
          icon="person_search"
          title={text(page, "회원 정보를 찾을 수 없습니다.", "Member not found.")}
        />
      ) : null}

      <CanView
        allowed={canView && hasMember}
        fallback={memberIdInput.trim() && hasMember && !pageState.loading ? <MemberStateCard description={String(page?.member_editError || "현재 계정으로는 회원 수정 화면을 조회할 수 없습니다.")} icon="lock" title={text(page, "권한이 없습니다.", "Permission denied.")} tone="warning" /> : null}
      >
        <AdminEditPageFrame>
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start" data-help-id="member-edit-page">
          <MemberEditSummarySection
            accessScopes={accessScopes}
            businessRoleDescription={businessRoleDescription}
            businessRoleLabel={businessRoleLabel}
            documentStatusLabel={documentStatusLabel}
            form={form}
            institutionInsttId={institutionInsttId}
            institutionStatusLabel={institutionStatusLabel}
            memberDocumentStatusLabel={memberDocumentStatusLabel}
            membershipTypeLabel={membershipTypeLabel}
            page={page}
            statusLabel={statusLabel}
          />

          <MemberEditMainSections
            canUse={canUse}
            featureCodes={featureCodes}
            form={form}
            memberEvidenceFiles={memberEvidenceFiles}
            page={page}
            permissionFeatureCount={featureCodes.length || permissionFeatureCount}
            permissionPageCount={permissionPageCount}
            permissionSelectedAuthorName={permissionSelectedAuthorName}
            resolvePermissionChipType={(featureCode) => {
              if (dynamicAddedFeatureCodes.includes(featureCode)) return "add";
              if (dynamicRemovedFeatureCodes.includes(featureCode)) return "remove";
              if (dynamicBaseFeatureCodes.has(featureCode)) return "base";
              return null;
            }}
            setForm={setForm}
            text={text}
            toggleFeature={toggleFeature}
          />
        </div>

        <div data-help-id="member-edit-actions">
          <MemberActionBar
            dataHelpId="member-edit-actions"
            description={text(
              page,
              "목록으로 돌아가거나 현재 회원의 상세 화면을 다시 확인한 뒤 저장할 수 있습니다.",
              "Return to the list, review the member detail page again, or save the current edits."
            )}
            eyebrow={text(page, "작업 흐름", "Action Flow")}
            primary={(
              <MemberPermissionButton
                allowed={canUse}
                className="w-full sm:w-auto sm:min-w-[220px] justify-center whitespace-nowrap shadow-lg shadow-blue-900/10"
                data-action="save"
                icon="save"
                onClick={handleSave}
                reason={text(page, "현재 관리자 권한으로 수정 가능한 회원만 저장할 수 있습니다.", "Only members editable by the current administrator can be saved.")}
                size="lg"
                type="button"
                variant="primary"
              >
                {text(page, MEMBER_BUTTON_LABELS.save, "Save")}
              </MemberPermissionButton>
            )}
            secondary={{
              href: buildLocalizedPath("/admin/member/list", "/en/admin/member/list"),
              icon: "list",
              label: text(page, MEMBER_BUTTON_LABELS.list, "List")
            }}
            tertiary={{
              href: buildLocalizedPath(`/admin/member/detail?memberId=${encodeURIComponent(form.memberId)}`, `/en/admin/member/detail?memberId=${encodeURIComponent(form.memberId)}`),
              icon: "preview",
              label: text(page, MEMBER_BUTTON_LABELS.detail, "Detail"),
            }}
            title={text(
              page,
              "수정 내용을 검토한 뒤 저장하세요.",
              "Review the changes, then save them."
            )}
          />
        </div>
        </AdminEditPageFrame>
      </CanView>
    </AdminPageShell>
  );
}
