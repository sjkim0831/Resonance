import { ChangeEvent, useCallback, useEffect, useState } from "react";
import { logGovernanceScope } from "../../app/policy/debug";
import { useFrontendSession } from "../../app/hooks/useFrontendSession";
import { CanView } from "../../components/access/CanView";
import { saveCompanyAccount } from "../../lib/api/adminActions";
import { fetchCompanyAccountPage } from "../../lib/api/adminMember";
import { checkCompanyNameDuplicate } from "../../lib/api/join";
import { buildLocalizedPath, getSearchParam } from "../../lib/navigation/runtime";
import { AdminPageShell } from "../admin-entry/AdminPageShell";
import { MemberActionBar, MemberLinkButton, MemberPermissionButton, MEMBER_BUTTON_LABELS, PageStatusNotice } from "../member/common";
import { AdminEditPageFrame } from "../admin-ui/pageFrames";
import {
  CompanyBusinessSection,
  CompanyContactSection,
  CompanyFilesSection,
  CompanyFormState,
  CompanyMembershipSection,
  UploadRow
} from "./companyAccountSections";
import { MemberStateCard } from "../member/sections";

const EMPTY_FORM: CompanyFormState = {
  insttId: "",
  membershipType: "E",
  agencyName: "",
  representativeName: "",
  bizRegistrationNumber: "",
  zipCode: "",
  companyAddress: "",
  companyAddressDetail: "",
  chargerName: "",
  chargerEmail: "",
  chargerTel: ""
};

let uploadRowSequence = 1;

function createUploadRow(): UploadRow {
  const row = { id: uploadRowSequence, file: null };
  uploadRowSequence += 1;
  return row;
}

export function CompanyAccountMigrationPage() {
  const routeInsttId = getSearchParam("insttId");
  const routeSaved = getSearchParam("saved");
  const routeErrorMessage = getSearchParam("errorMessage");

  const [form, setForm] = useState<CompanyFormState>(EMPTY_FORM);
  const [activeInsttId, setActiveInsttId] = useState(routeInsttId);
  const [uploadRows, setUploadRows] = useState<UploadRow[]>([createUploadRow()]);
  const [actionError, setActionError] = useState(routeErrorMessage);
  const [message, setMessage] = useState("");
  const [nameCheckMessage, setNameCheckMessage] = useState("");
  const [isNameChecked, setIsNameChecked] = useState(false);
  const [reloadNonce, setReloadNonce] = useState(0);
  
  const [pageData, setPageData] = useState<{
    fileRows: Array<Record<string, unknown>>;
    canView: boolean;
    canUseSave: boolean;
    isEditMode: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  const sessionState = useFrontendSession();

  useEffect(() => {
    setActiveInsttId(routeInsttId);
    setActionError(routeErrorMessage);
    setMessage("");
  }, [routeErrorMessage, routeInsttId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    setPageData(null);

    fetchCompanyAccountPage(activeInsttId || undefined, { saved: routeSaved || undefined })
      .then(data => {
        if (cancelled) return;
        const source = data.companyAccountForm || {};
        const resolvedInsttId = String(source.insttId || activeInsttId || "");
        const resolvedAgencyName = String(source.insttNm || "");
        setForm({
          insttId: resolvedInsttId,
          membershipType: String(source.entrprsSeCode || "E"),
          agencyName: resolvedAgencyName,
          representativeName: String(source.reprsntNm || ""),
          bizRegistrationNumber: String(source.bizrno || ""),
          zipCode: String(source.zip || ""),
          companyAddress: String(source.adres || ""),
          companyAddressDetail: String(source.detailAdres || ""),
          chargerName: String(source.chargerNm || ""),
          chargerEmail: String(source.chargerEmail || ""),
          chargerTel: String(source.chargerTel || "")
        });
        setUploadRows([createUploadRow()]);
        if (resolvedInsttId.trim() && resolvedAgencyName.trim()) {
          setIsNameChecked(true);
          setNameCheckMessage("");
        } else {
          setIsNameChecked(false);
          setNameCheckMessage("");
        }
        setPageData({
          fileRows: data.companyAccountFiles || [],
          canView: data.canViewCompanyAccount !== false,
          canUseSave: data.canUseCompanyAccountSave === true,
          isEditMode: data.isEditMode === true
        });
        setLoading(false);
      })
      .catch(err => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "데이터 로딩 실패");
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [activeInsttId, reloadNonce, routeSaved]);

  useEffect(() => {
    if (daumScriptLoaded) return;
    daumScriptLoaded = true;
    const script = document.createElement("script");
    script.src = "//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js";
    script.async = true;
    document.body.appendChild(script);
    return () => {
      daumScriptLoaded = false;
      const existingScript = document.querySelector('script[src*="daumcdn.net"]');
      if (existingScript) existingScript.remove();
    };
  }, []);

  const updateField = useCallback((key: keyof CompanyFormState, value: string) => {
    if (key === "agencyName") {
      const nextName = value.trim();
      const originalInsttId = form.insttId;
      const originalName = pageData?.isEditMode ? "" : "";
      if (originalInsttId && nextName && nextName === originalName) {
        setIsNameChecked(true);
        setNameCheckMessage("");
      } else {
        setIsNameChecked(false);
      }
    }
    setForm(prev => ({ ...prev, [key]: value }));
  }, [form.insttId, pageData?.isEditMode]);

  const handleCheckDuplicate = useCallback(async () => {
    logGovernanceScope("ACTION", "company-account-duplicate-check", {
      actorInsttId: sessionState.value?.insttId || "",
      agencyName: form.agencyName.trim()
    });
    const name = form.agencyName.trim();
    if (!name) {
      setActionError("기관/회사명을 입력해 주세요.");
      return;
    }
    setActionError("");
    try {
      const duplicated = await checkCompanyNameDuplicate(name);
      if (duplicated) {
        setIsNameChecked(false);
        setNameCheckMessage("이미 등록된 기관/회사명입니다.");
        return;
      }
      setIsNameChecked(true);
      setNameCheckMessage("사용 가능한 기관/회사명입니다.");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "중복 확인 중 오류가 발생했습니다.");
    }
  }, [form.agencyName, sessionState.value?.insttId]);

  const handleAddressSearch = useCallback(() => {
    if (typeof window === "undefined") return;
    const daum = (window as Window & { daum?: { Postcode?: new (options: { oncomplete: (data: { zonecode?: string; roadAddress?: string; jibunAddress?: string; userSelectedType?: string; }) => void; }) => { open: () => void; }; }; }).daum;
    if (!daum?.Postcode) {
      setActionError("주소 검색 도구를 불러오지 못했습니다.");
      return;
    }
    new daum.Postcode({
      oncomplete(data) {
        const address = data.userSelectedType === "R" ? (data.roadAddress || "") : (data.jibunAddress || "");
        setForm(prev => ({ ...prev, zipCode: String(data.zonecode || ""), companyAddress: address }));
      }
    }).open();
  }, []);

  const handleSave = useCallback(async () => {
    logGovernanceScope("ACTION", "company-account-save", {
      actorInsttId: sessionState.value?.insttId || "",
      insttId: form.insttId,
      membershipType: form.membershipType,
      uploadCount: uploadRows.filter((row) => !!row.file).length
    });
    const session = sessionState.value;
    if (!session) return;
    setActionError("");
    setMessage("");
    if (!pageData?.isEditMode && !isNameChecked) {
      setActionError("기관/회사명 중복 확인이 필요합니다.");
      return;
    }
    const uploadedFiles = uploadRows.map(row => row.file).filter((f): f is File => Boolean(f && f.size > 0));
    try {
      const result = await saveCompanyAccount(session, {
        insttId: form.insttId || undefined,
        membershipType: form.membershipType,
        agencyName: pageData?.isEditMode ? undefined : form.agencyName,
        representativeName: pageData?.isEditMode ? undefined : form.representativeName,
        bizRegistrationNumber: pageData?.isEditMode ? undefined : form.bizRegistrationNumber,
        zipCode: form.zipCode,
        companyAddress: form.companyAddress,
        companyAddressDetail: form.companyAddressDetail,
        chargerName: form.chargerName,
        chargerEmail: form.chargerEmail,
        chargerTel: form.chargerTel,
        fileUploads: uploadedFiles
      });
      setMessage(`${result.insttId} 회원사 정보를 저장했습니다.`);
      if (result.insttId === activeInsttId) {
        setReloadNonce((current) => current + 1);
      } else {
        setActiveInsttId(result.insttId);
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "저장 실패");
    }
  }, [sessionState.value, form, pageData?.isEditMode, isNameChecked, uploadRows, activeInsttId]);

  const formatBytes = useCallback((bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const units = ["Bytes", "KB", "MB", "GB"];
    const index = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${parseFloat((bytes / 1024 ** index).toFixed(2))} ${units[index]}`;
  }, []);

  const handleFileChange = useCallback((index: number, event: ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0];
    if (!nextFile) {
      setUploadRows(prev => prev.map((row, i) => i === index ? { ...row, file: null } : row));
      return;
    }
    const lower = nextFile.name.toLowerCase();
    const okExt = [".pdf", ".jpg", ".jpeg", ".png"].some(ext => lower.endsWith(ext));
    if (!okExt) {
      window.alert("PDF, JPG, PNG 파일만 업로드 가능합니다.");
      event.target.value = "";
      return;
    }
    if (nextFile.size > 10 * 1024 * 1024) {
      window.alert("파일 크기는 10MB 이하만 가능합니다.");
      event.target.value = "";
      return;
    }
    setUploadRows(prev => prev.map((row, i) => i === index ? { ...row, file: nextFile } : row));
  }, []);

  const addFileRow = useCallback(() => {
    setUploadRows(prev => [...prev, createUploadRow()]);
  }, []);

  const removeFileRow = useCallback((index: number) => {
    setUploadRows(prev => {
      if (prev.length <= 1) return [{ ...prev[0], file: null }];
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  useEffect(() => {
    if (!pageData || !sessionState.value) {
      return;
    }
    logGovernanceScope("PAGE", "company-account", {
      route: window.location.pathname,
      actorUserId: sessionState.value.userId || "",
      actorAuthorCode: sessionState.value.authorCode || "",
      actorInsttId: sessionState.value.insttId || "",
      canView: pageData.canView,
      canUseSave: pageData.canUseSave,
      selectedInsttId: form.insttId,
      membershipType: form.membershipType
    });
    logGovernanceScope("COMPONENT", "company-account-files", {
      component: "company-account-files",
      selectedInsttId: form.insttId,
      existingFileCount: pageData.fileRows.length,
      uploadRowCount: uploadRows.length
    });
  }, [form.insttId, form.membershipType, pageData, sessionState.value, uploadRows.length]);

  return (
    <AdminPageShell
      actions={(
        <MemberLinkButton href={buildLocalizedPath("/admin/member/company_list", "/en/admin/member/company_list")} icon="list" variant="secondary">
          {MEMBER_BUTTON_LABELS.list}
        </MemberLinkButton>
      )}
      breadcrumbs={[
        { label: "홈", href: buildLocalizedPath("/admin/", "/en/admin/") },
        { label: "회원관리" },
        { label: "회원사" },
        { label: form.insttId ? "회원사 수정" : "신규 회원사 등록" }
      ]}
      subtitle={form.insttId ? "기존 회원사 신청 정보를 수정합니다." : "회원사 신청 정보를 관리자 화면에서 직접 등록합니다."}
      title={form.insttId ? "회원사 수정" : "신규 회원사 등록"}
      loading={loading}
      loadingLabel="회원사 정보를 불러오는 중입니다."
    >
      {message ? <PageStatusNotice tone="success">{message}</PageStatusNotice> : null}
      {error || actionError || sessionState.error ? <PageStatusNotice tone="error">{error || actionError || sessionState.error}</PageStatusNotice> : null}
      {!loading && pageData && !pageData.canView ? (
        <MemberStateCard description="현재 계정으로는 회원사 관리 화면을 조회할 수 없습니다." icon="lock" title="권한이 없습니다." tone="warning" />
      ) : null}
      <CanView allowed={pageData?.canView ?? false} fallback={null}>
        <AdminEditPageFrame>
          <div className="border border-[var(--kr-gov-border-light)] rounded-[var(--kr-gov-radius)] bg-white p-8 shadow-sm" data-help-id="company-account-page">
            {form.insttId ? (
              <div className="mb-8 flex items-center justify-between rounded-[var(--kr-gov-radius)] border border-slate-200 bg-slate-50 px-4 py-3">
                <div>
                  <p className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">현재 수정 대상</p>
                  <p className="mt-1 text-sm font-bold text-[var(--kr-gov-text-primary)]">{form.agencyName || "회원사"}</p>
                </div>
                <span className="inline-flex items-center rounded-full bg-white px-3 py-1 text-xs font-bold text-[var(--kr-gov-blue)]">{form.insttId}</span>
              </div>
            ) : null}
            <div className="space-y-8">
              <CompanyMembershipSection canUse={pageData?.canUseSave ?? false} form={form} updateField={updateField} />
              <div data-help-id="company-account-lookup">
                <CompanyBusinessSection canUseSave={pageData?.canUseSave ?? false} form={form} handleAddressSearch={handleAddressSearch} handleCheckDuplicate={handleCheckDuplicate} isEditMode={pageData?.isEditMode ?? false} isNameChecked={isNameChecked} nameCheckMessage={nameCheckMessage} updateField={updateField} />
              </div>
              <CompanyContactSection canUseSave={pageData?.canUseSave ?? false} form={form} updateField={updateField} />
              <div data-help-id="company-account-file-table">
                <CompanyFilesSection addFileRow={addFileRow} canUseSave={pageData?.canUseSave ?? false} fileRows={pageData?.fileRows || []} formatBytes={formatBytes} handleFileChange={handleFileChange} removeFileRow={removeFileRow} uploadRows={uploadRows} />
              </div>
              <div data-help-id="company-account-actions">
                <MemberActionBar
                  dataHelpId="company-account-actions"
                  description={form.insttId ? "회원사 목록으로 돌아가거나 현재 수정 내용을 검토한 뒤 저장할 수 있습니다." : "회원사 목록으로 돌아가거나 입력한 회원사 정보를 검토한 뒤 저장할 수 있습니다."}
                  eyebrow="작업 흐름"
                  primary={(
                    <MemberPermissionButton
                      allowed={pageData?.canUseSave ?? false}
                      className="w-full sm:w-auto sm:min-w-[220px] justify-center whitespace-nowrap shadow-lg shadow-blue-900/10"
                      data-action="save"
                      icon="arrow_forward"
                      onClick={handleSave}
                      reason="전체 관리자만 회원사 정보를 저장할 수 있습니다."
                      size="lg"
                      type="button"
                      variant="primary"
                    >
                      {MEMBER_BUTTON_LABELS.save}
                    </MemberPermissionButton>
                  )}
                  secondary={{
                    href: buildLocalizedPath("/admin/member/company_list", "/en/admin/member/company_list"),
                    label: MEMBER_BUTTON_LABELS.list
                  }}
                  title={form.insttId ? "회원사 정보를 검토한 뒤 수정 내용을 저장하세요." : "입력한 회원사 정보를 검토한 뒤 등록 내용을 저장하세요."}
                />
              </div>
            </div>
          </div>
        </AdminEditPageFrame>
      </CanView>
    </AdminPageShell>
  );
}

let daumScriptLoaded = false;
