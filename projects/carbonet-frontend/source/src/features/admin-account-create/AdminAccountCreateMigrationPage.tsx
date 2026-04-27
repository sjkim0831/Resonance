import { useEffect, useMemo, useState } from "react";
import { logGovernanceScope } from "../../app/policy/debug";
import { CanView } from "../../components/access/CanView";
import { createAdminAccount } from "../../lib/api/adminActions";
import { fetchAdminAccountCreatePage, checkAdminAccountId, searchAdminCompanies } from "../../lib/api/adminMember";
import { fetchFrontendSession } from "../../lib/api/adminShell";
import type { FrontendSession } from "../../lib/api/adminShellTypes";
import type { AdminAccountCreatePagePayload, CompanySearchPayload } from "../../lib/api/memberTypes";
import { buildLocalizedPath, navigate } from "../../lib/navigation/runtime";
import { AdminPageShell } from "../admin-entry/AdminPageShell";
import { ADMIN_BUTTON_LABELS } from "../admin-ui/labels";
import {
  AdminInput,
  AdminSelect,
  GridToolbar,
  MemberActionBar,
  MemberPermissionButton,
  PageStatusNotice
} from "../admin-ui/common";
import { AdminEditPageFrame } from "../admin-ui/pageFrames";
import { MemberStateCard } from "../member/sections";

const ROLE_PRESETS = [
  { code: "MASTER", label: "마스터 관리자" },
  { code: "SYSTEM", label: "시스템 관리자" },
  { code: "OPERATION", label: "운영 관리자" }
] as const;

const ROLE_PRESET_SUMMARIES: Record<string, string> = {
  MASTER: "기관 검색 없이 마스터 관리자 권한을 바로 부여합니다.",
  SYSTEM: "소속 회사 기준으로 설정, 계정, 운영 체계를 총괄합니다.",
  OPERATION: "소속 회사 기준으로 실무 운영과 현장 업무를 담당합니다."
};

function roleChipClass(active: boolean) {
  return `flex min-h-[56px] w-full items-center justify-center rounded-[var(--kr-gov-radius)] border px-4 text-center text-sm font-bold whitespace-nowrap transition-all ${
    active
      ? "border-[var(--kr-gov-blue)] bg-blue-50 text-[var(--kr-gov-blue)] shadow-sm"
      : "border-[var(--kr-gov-border-light)] bg-white text-[var(--kr-gov-text-secondary)] hover:border-[var(--kr-gov-blue)]/40 hover:bg-slate-50"
  }`;
}

function membershipTypeLabel(entrprsSeCode: string) {
  const normalized = String(entrprsSeCode || "").trim().toUpperCase();
  if (normalized === "E") return "CO2 배출사업자";
  if (normalized === "P") return "CCUS 프로젝트 사업자";
  if (normalized === "C") return "진흥·지원 기관";
  if (normalized === "G") return "관계 기관·주무관청";
  return "";
}

type CompanyResult = CompanySearchPayload["list"][number];

let daumScriptLoaded = false;

export function AdminAccountCreateMigrationPage() {
  const [session, setSession] = useState<FrontendSession | null>(null);
  const [page, setPage] = useState<AdminAccountCreatePagePayload | null>(null);
  const [rolePreset, setRolePreset] = useState("MASTER");
  const [adminId, setAdminId] = useState("");
  const [adminName, setAdminName] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [phone1, setPhone1] = useState("010");
  const [phone2, setPhone2] = useState("");
  const [phone3, setPhone3] = useState("");
  const [deptNm, setDeptNm] = useState("");
  const [zip, setZip] = useState("");
  const [adres, setAdres] = useState("");
  const [detailAdres, setDetailAdres] = useState("");
  const [insttId, setInsttId] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [bizrno, setBizrno] = useState("");
  const [representativeName, setRepresentativeName] = useState("");
  const [companyTypeLabel, setCompanyTypeLabel] = useState("");
  const [companyKeyword, setCompanyKeyword] = useState("");
  const [companySearch, setCompanySearch] = useState<CompanySearchPayload | null>(null);
  const [companySearchOpen, setCompanySearchOpen] = useState(false);
  const [idCheckMessage, setIdCheckMessage] = useState("");
  const [error, setError] = useState("");
  const [searchingCompanies, setSearchingCompanies] = useState(false);
  const canUseCreate = !!page?.canUseAdminAccountCreate;
  const presetAuthorCodes = (page?.adminAccountCreatePresetAuthorCodes || {}) as Record<string, string>;
  const allowedPresets = (((page?.adminAccountCreateAllowedPresets as string[] | undefined) || Object.keys(presetAuthorCodes))).map((item) => String(item));
  const canSearchCompanies = rolePreset !== "MASTER";

  useEffect(() => {
    Promise.all([fetchFrontendSession(), fetchAdminAccountCreatePage()])
      .then(([sessionPayload, pagePayload]) => {
        setSession(sessionPayload);
        setPage(pagePayload);
        const presetOptions = (((pagePayload.adminAccountCreateAllowedPresets as string[] | undefined)
          || Object.keys((pagePayload.adminAccountCreatePresetAuthorCodes || {}) as Record<string, string>))).map((item) => String(item));
        setRolePreset(presetOptions[0] || String(pagePayload.adminAccountCreatePreset || "MASTER"));
        if (!Boolean(pagePayload.adminAccountCreateCanSearchCompanies)) {
          setInsttId(String(pagePayload.adminAccountCreateCurrentInsttId || ""));
          setCompanyName(String(pagePayload.adminAccountCreateCurrentCompanyName || ""));
          setBizrno(String(pagePayload.adminAccountCreateCurrentBizrno || ""));
          setRepresentativeName(String(pagePayload.adminAccountCreateCurrentRepresentativeName || ""));
        }
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  useEffect(() => {
    if (rolePreset === "MASTER") {
      setInsttId("");
      setCompanyName("");
      setBizrno("");
      setRepresentativeName("");
      setCompanyTypeLabel("");
    } else if (!canSearchCompanies) {
      setInsttId(String(page?.adminAccountCreateCurrentInsttId || ""));
      setCompanyName(String(page?.adminAccountCreateCurrentCompanyName || ""));
      setBizrno(String(page?.adminAccountCreateCurrentBizrno || ""));
      setRepresentativeName(String(page?.adminAccountCreateCurrentRepresentativeName || ""));
    }
  }, [canSearchCompanies, page, rolePreset]);

  useEffect(() => {
    if (daumScriptLoaded || typeof document === "undefined") {
      return;
    }
    daumScriptLoaded = true;
    const script = document.createElement("script");
    script.src = "//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js";
    script.async = true;
    document.body.appendChild(script);
    return () => {
      daumScriptLoaded = false;
      script.remove();
    };
  }, []);

  const filteredCompanyResults = useMemo(() => companySearch?.list || [], [companySearch]);
  const selectedOrgSummary = useMemo(() => {
    if (!insttId || !companyName) {
      return null;
    }
    return [
      { label: "기관 ID", value: insttId },
      { label: "사업자등록번호", value: bizrno || "-" },
      { label: "대표자", value: representativeName || "-" }
    ];
  }, [bizrno, companyName, insttId, representativeName]);

  useEffect(() => {
    if (!page || !session) {
      return;
    }
    logGovernanceScope("PAGE", "admin-account-create", {
      route: window.location.pathname,
      actorUserId: session.userId || "",
      actorAuthorCode: session.authorCode || "",
      actorInsttId: session.insttId || "",
      canUseCreate: !!page.canUseAdminAccountCreate,
      rolePreset,
      selectedInsttId: insttId
    });
    logGovernanceScope("COMPONENT", "admin-account-org-search", {
      component: "admin-account-org-search",
      allowed: canSearchCompanies,
      rolePreset,
      selectedInsttId: insttId,
      companySearchOpen
    });
  }, [canSearchCompanies, companySearchOpen, insttId, page, rolePreset, session]);

  function resetForm() {
    setAdminId("");
    setAdminName("");
    setPassword("");
    setPasswordConfirm("");
    setAdminEmail("");
    setPhone1("010");
    setPhone2("");
    setPhone3("");
    setDeptNm("");
    setZip("");
    setAdres("");
    setDetailAdres("");
    setInsttId("");
    setCompanyName("");
    setBizrno("");
    setRepresentativeName("");
    setCompanyTypeLabel("");
    setCompanyKeyword("");
    setCompanySearch(null);
    setCompanySearchOpen(false);
    setIdCheckMessage("");
  }

  function applyCompany(item: CompanyResult) {
    setInsttId(item.insttId);
    setCompanyName(item.cmpnyNm);
    setBizrno(item.bizrno);
    setRepresentativeName(item.cxfc);
    setCompanyTypeLabel(membershipTypeLabel(item.entrprsSeCode));
    setCompanySearchOpen(false);
  }

  async function handleCheckId() {
    logGovernanceScope("ACTION", "admin-account-id-check", {
      actorInsttId: session?.insttId || "",
      adminId
    });
    setError("");
    setIdCheckMessage("");
    try {
      const result = await checkAdminAccountId(adminId);
      setIdCheckMessage(result.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "ID 확인 실패");
    }
  }

  async function handleCompanySearch(pageIndex = 1) {
    logGovernanceScope("ACTION", "admin-account-org-search", {
      actorInsttId: session?.insttId || "",
      rolePreset,
      keyword: companyKeyword,
      pageIndex
    });
    setError("");
    setSearchingCompanies(true);
    try {
      const result = await searchAdminCompanies({
        keyword: companyKeyword,
        page: pageIndex,
        size: 5
      });
      setCompanySearch(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "회사 검색 실패");
    } finally {
      setSearchingCompanies(false);
    }
  }

  function openCompanySearch() {
    setCompanySearchOpen(true);
    setError("");
    void handleCompanySearch(1);
  }

  function handleAddressSearch() {
    if (typeof window === "undefined") {
      return;
    }
    const daum = (window as Window & {
      daum?: {
        Postcode?: new (options: {
          oncomplete: (data: {
            zonecode?: string;
            roadAddress?: string;
            jibunAddress?: string;
            userSelectedType?: string;
          }) => void;
        }) => { open: () => void };
      };
    }).daum;
    if (!daum?.Postcode) {
      setError("주소 검색 도구를 불러오지 못했습니다.");
      return;
    }
    new daum.Postcode({
      oncomplete: (data) => {
        const selectedAddress = data.userSelectedType === "R" ? (data.roadAddress || "") : (data.jibunAddress || "");
        setZip(String(data.zonecode || ""));
        setAdres(selectedAddress);
        setError("");
      }
    }).open();
  }

  async function handleSave() {
    logGovernanceScope("ACTION", "admin-account-create", {
      actorInsttId: session?.insttId || "",
      rolePreset,
      selectedInsttId: insttId,
      selectedCompanyType: companyTypeLabel
    });
    if (!session) return;
    setError("");
    try {
      if (rolePreset !== "MASTER" && !insttId) {
        throw new Error("시스템 관리자와 운영 관리자는 기관 검색으로 소속 회사를 지정해야 합니다.");
      }
      await createAdminAccount(session, {
        rolePreset,
        adminId,
        adminName,
        password,
        passwordConfirm,
        adminEmail,
        phone1,
        phone2,
        phone3,
        deptNm,
        insttId,
        zip,
        adres,
        detailAdres,
        featureCodes: []
      });
      navigate(buildLocalizedPath("/admin/member/admin_list", "/en/admin/member/admin_list"));
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장 실패");
    }
  }

  return (
    <AdminPageShell
      breadcrumbs={[
        { label: "홈", href: buildLocalizedPath("/admin/", "/en/admin/") },
        { label: "회원·권한 관리" },
        { label: "관리자 사용자 추가" }
      ]}
      subtitle="관리자 계정 정보와 권한, 소속 정보를 입력합니다."
      title="관리자 사용자 추가"
    >
      {error ? <PageStatusNotice tone="error">{error}</PageStatusNotice> : null}
      {!!page && !page?.canViewAdminAccountCreate ? (
        <MemberStateCard description="현재 계정으로는 관리자 생성 화면을 조회할 수 없습니다." icon="lock" title="권한이 없습니다." tone="warning" />
      ) : null}

      <CanView
        allowed={!!page?.canViewAdminAccountCreate}
        fallback={null}
      >
        <form
          className=""
          onSubmit={(e) => {
            e.preventDefault();
            void handleSave();
          }}
        >
          <AdminEditPageFrame>
          <section className="section-shell border border-[var(--kr-gov-border-light)] rounded-[var(--kr-gov-radius)] bg-white shadow-sm" data-help-id="admin-create-role">
            <GridToolbar
              actions={<span className="material-symbols-outlined text-[var(--kr-gov-blue)]">shield_person</span>}
              meta="마스터 관리자는 기관 검색 없이 생성하고, 시스템·운영 관리자는 소속 기관을 지정합니다."
              title="관리 권한 프리셋 선택"
            />
            <div className="p-6">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                {ROLE_PRESETS.filter((preset) => allowedPresets.length === 0 || allowedPresets.includes(preset.code)).map((preset) => (
                  <button
                    className={roleChipClass(rolePreset === preset.code)}
                    disabled={!canUseCreate}
                    key={preset.code}
                    onClick={() => setRolePreset(preset.code)}
                    type="button"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <div className="mt-4 rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-50 px-4 py-3 text-sm text-[var(--kr-gov-text-secondary)]">
                {ROLE_PRESET_SUMMARIES[rolePreset] || ROLE_PRESET_SUMMARIES.MASTER}
              </div>
            </div>
          </section>

          <section className="section-shell border border-[var(--kr-gov-border-light)] rounded-[var(--kr-gov-radius)] bg-white shadow-sm" data-help-id="admin-create-account">
            <GridToolbar
              actions={<span className="material-symbols-outlined text-[var(--kr-gov-blue)]">manage_accounts</span>}
              title="계정 정보"
            />
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1">
                <label className="form-label block text-sm font-bold text-[var(--kr-gov-text-primary)] mb-2" htmlFor="admin-id">아이디 <span className="text-red-500">*</span></label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <AdminInput className="sm:flex-1" disabled={!canUseCreate} id="admin-id" placeholder="6~16자 영문, 숫자" spellCheck={false} value={adminId} onChange={(e) => setAdminId(e.target.value)} />
                  <MemberPermissionButton allowed={canUseCreate} className="shrink-0 whitespace-nowrap sm:min-w-[126px]" onClick={handleCheckId} reason="생성 권한이 있어야 중복 확인을 사용할 수 있습니다." type="button" variant="primary">중복 확인</MemberPermissionButton>
                </div>
                {idCheckMessage ? <div className="text-sm text-[var(--kr-gov-blue)]">{idCheckMessage}</div> : null}
              </div>
              <div className="space-y-1">
                <label className="form-label block text-sm font-bold text-[var(--kr-gov-text-primary)] mb-2" htmlFor="password">비밀번호 <span className="text-red-500">*</span></label>
                <AdminInput disabled={!canUseCreate} id="password" placeholder="영문, 숫자, 특수문자 조합 8자 이상" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="form-label block text-sm font-bold text-[var(--kr-gov-text-primary)] mb-2" htmlFor="password-confirm">비밀번호 확인 <span className="text-red-500">*</span></label>
                <AdminInput disabled={!canUseCreate} id="password-confirm" placeholder="비밀번호를 다시 입력하세요" type="password" value={passwordConfirm} onChange={(e) => setPasswordConfirm(e.target.value)} />
                {passwordConfirm ? (
                  <div className={`text-sm ${password === passwordConfirm ? "text-[var(--kr-gov-success)]" : "text-[var(--kr-gov-error)]"}`}>
                    {password === passwordConfirm ? "비밀번호가 일치합니다." : "비밀번호가 일치하지 않습니다."}
                  </div>
                ) : null}
              </div>
            </div>
          </section>

          <div className="grid grid-cols-1 gap-6" id="infoSectionGrid">
            {rolePreset !== "MASTER" ? (
              <section className="section-shell border border-[var(--kr-gov-border-light)] rounded-[var(--kr-gov-radius)] bg-white shadow-sm" data-help-id="admin-create-permissions">
                <GridToolbar
                  actions={<span className="material-symbols-outlined text-[var(--kr-gov-blue)]">corporate_fare</span>}
                  meta="시스템 관리자와 운영 관리자는 기관 검색으로 소속 회사를 선택하면 해당 기관 기준으로 가입이 진행됩니다."
                  title="소속 정보"
                />
                <div className="p-6 space-y-6">
                  <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-[#f8fafc] p-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--kr-gov-blue)]">기관 검색</p>
                        <p className="mt-2 text-sm leading-6 text-[var(--kr-gov-text-secondary)]">
                          대상 회사를 먼저 검색하세요. 선택한 회사 정보가 관리자 계정 소속 기준으로 반영됩니다.
                        </p>
                      </div>
                      <MemberPermissionButton
                        allowed={canUseCreate}
                        icon="search"
                        onClick={openCompanySearch}
                        reason="관리자 생성 권한이 있어야 기관 검색을 사용할 수 있습니다."
                        type="button"
                        variant="secondary"
                      >
                        기관 검색
                      </MemberPermissionButton>
                    </div>
                  </div>
                  <div>
                    <label className="form-label" htmlFor="company-search">소속 기관/기업명 <span className="required">*</span></label>
                    <input className="gov-input bg-gray-50" id="company-search" placeholder="기관 검색으로 소속 기관을 선택해 주세요" readOnly value={companyName} />
                  </div>
                  {selectedOrgSummary ? (
                    <div className="grid gap-3 sm:grid-cols-3">
                      {selectedOrgSummary.map((item) => (
                        <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white px-4 py-3" key={item.label}>
                          <p className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{item.label}</p>
                          <p className="mt-1 text-sm font-bold text-[var(--kr-gov-text-primary)]">{item.value}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-[var(--kr-gov-radius)] border border-dashed border-[var(--kr-gov-border-light)] bg-gray-50 px-4 py-6 text-sm text-[var(--kr-gov-text-secondary)]">
                      아직 연결된 기관이 없습니다. 기관 검색 창에서 소속 기관을 선택한 뒤 저장하세요.
                    </div>
                  )}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="form-label" htmlFor="instt-id">기관 ID <span className="required">*</span></label>
                      <input className="gov-input bg-gray-50" id="instt-id" readOnly value={insttId} />
                    </div>
                    <div>
                      <label className="form-label" htmlFor="biz-number">사업자등록번호</label>
                      <input className="gov-input bg-gray-50" id="biz-number" readOnly value={bizrno} />
                    </div>
                  </div>
                  <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-50 px-4 py-4">
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--kr-gov-blue)]">회원 유형</p>
                    <p className="mt-2 text-base font-bold text-[var(--kr-gov-text-primary)]">{companyTypeLabel || "선택 기관 기준"}</p>
                    <p className="mt-2 text-xs text-[var(--kr-gov-text-secondary)]">회원사 유형은 기관 검색으로 선택한 기관의 유형을 자동으로 따르며 이 화면에서 별도 선택하지 않습니다.</p>
                  </div>
                  <div>
                    <label className="form-label" htmlFor="department">부서명</label>
                    <AdminInput disabled={!canUseCreate} id="department" placeholder="부서명을 입력하세요" value={deptNm} onChange={(e) => setDeptNm(e.target.value)} />
                  </div>
                </div>
              </section>
            ) : null}

            <section className={`section-shell border border-[var(--kr-gov-border-light)] rounded-[var(--kr-gov-radius)] bg-white shadow-sm ${rolePreset === "MASTER" ? "xl:col-span-2" : ""}`}>
              <div className="flex items-center gap-2 px-6 py-4 border-b border-[var(--kr-gov-border-light)]">
                <span className="material-symbols-outlined text-[var(--kr-gov-blue)]">badge</span>
                <h3 className="text-lg font-bold text-[var(--kr-gov-text-primary)]">개인 정보</h3>
              </div>
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2 space-y-1">
                  <label className="form-label block text-sm font-bold text-[var(--kr-gov-text-primary)] mb-2" htmlFor="user-name">성명 <span className="text-red-500">*</span></label>
                  <AdminInput disabled={!canUseCreate} id="user-name" placeholder="사용자 성함을 입력하세요" value={adminName} onChange={(e) => setAdminName(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <label className="form-label block text-sm font-bold text-[var(--kr-gov-text-primary)] mb-2" htmlFor="email">공식 이메일 <span className="text-red-500">*</span></label>
                  <AdminInput disabled={!canUseCreate} id="email" placeholder="example@korea.kr / domain.com" type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <label className="form-label block text-sm font-bold text-[var(--kr-gov-text-primary)] mb-2" htmlFor="contact-mid">연락처 <span className="text-red-500">*</span></label>
                  <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
                    <AdminSelect className="min-w-0" disabled={!canUseCreate} value={phone1} onChange={(e) => setPhone1(e.target.value)}>
                      <option value="010">010</option>
                      <option value="011">011</option>
                      <option value="02">02</option>
                    </AdminSelect>
                    <span className="flex items-center">-</span>
                    <AdminInput className="min-w-0" disabled={!canUseCreate} id="contact-mid" inputMode="numeric" value={phone2} onChange={(e) => setPhone2(e.target.value)} />
                    <span className="flex items-center">-</span>
                    <AdminInput className="min-w-0" disabled={!canUseCreate} inputMode="numeric" value={phone3} onChange={(e) => setPhone3(e.target.value)} />
                  </div>
                </div>
                <div className="md:col-span-2 space-y-1">
                  <label className="form-label block text-sm font-bold text-[var(--kr-gov-text-primary)] mb-2" htmlFor="admin-zip">우편번호 <span className="text-red-500">*</span></label>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <AdminInput className="min-w-0 cursor-pointer bg-gray-50 sm:w-32" disabled={!canUseCreate} id="admin-zip" onClick={handleAddressSearch} placeholder="우편번호" readOnly value={zip} />
                    <MemberPermissionButton allowed={canUseCreate} className="shrink-0 whitespace-nowrap sm:min-w-[126px]" icon="search" onClick={handleAddressSearch} reason="관리자 생성 권한이 있어야 주소 검색을 사용할 수 있습니다." type="button" variant="secondary">
                      주소 검색
                    </MemberPermissionButton>
                  </div>
                </div>
                <div className="md:col-span-2 space-y-1">
                  <label className="form-label block text-sm font-bold text-[var(--kr-gov-text-primary)] mb-2" htmlFor="admin-address">주소 <span className="text-red-500">*</span></label>
                  <AdminInput className="cursor-pointer bg-gray-50" disabled={!canUseCreate} id="admin-address" onClick={handleAddressSearch} placeholder="주소 검색 버튼을 눌러 기본 주소를 선택하세요" readOnly value={adres} />
                </div>
                <div className="md:col-span-2 space-y-1">
                  <label className="form-label block text-sm font-bold text-[var(--kr-gov-text-primary)] mb-2" htmlFor="admin-address-detail">상세 주소</label>
                  <AdminInput disabled={!canUseCreate} id="admin-address-detail" placeholder="상세 주소를 입력하세요" value={detailAdres} onChange={(e) => setDetailAdres(e.target.value)} />
                </div>
              </div>
            </section>

          </div>

          <MemberActionBar
            dataHelpId="admin-create-actions"
            description="관리자 목록으로 돌아가거나 입력값을 초기화한 뒤 현재 관리자 계정을 등록할 수 있습니다."
            eyebrow="작업 흐름"
            primary={(
              <MemberPermissionButton
                allowed={canUseCreate}
                className="w-full sm:w-auto sm:min-w-[220px] justify-center whitespace-nowrap shadow-lg shadow-blue-900/10"
                icon="person_add"
                onClick={handleSave}
                reason="webmaster만 관리자 계정을 생성할 수 있습니다."
                size="lg"
                type="button"
                variant="primary"
              >
                {ADMIN_BUTTON_LABELS.create}
              </MemberPermissionButton>
            )}
            secondary={{
              href: buildLocalizedPath("/admin/member/admin_list", "/en/admin/member/admin_list"),
              icon: "list",
              label: ADMIN_BUTTON_LABELS.list
            }}
            tertiary={{
              icon: "refresh",
              label: ADMIN_BUTTON_LABELS.reset,
              onClick: resetForm
            }}
            title="입력한 관리자 정보와 소속 정보를 검토한 뒤 등록하세요."
          />
          </AdminEditPageFrame>
        </form>

        <div aria-labelledby="admin-account-org-search-title" aria-modal="true" className={`${companySearchOpen ? "fixed" : "hidden"} inset-0 z-[1000] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm`} role="dialog">
          <div className="w-full max-w-[960px] overflow-hidden rounded-[calc(var(--kr-gov-radius)+8px)] bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[var(--kr-gov-border-light)] px-6 py-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--kr-gov-blue)]">기관 검색</p>
                <h3 className="mt-1 text-lg font-black" id="admin-account-org-search-title">기관을 검색하고 선택하세요.</h3>
              </div>
              <button className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--kr-gov-border-light)] text-[var(--kr-gov-text-secondary)] hover:bg-gray-50" onClick={() => setCompanySearchOpen(false)} type="button">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="space-y-5 px-6 py-6">
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
                <label>
                  <span className="mb-2 block text-sm font-bold text-[var(--kr-gov-text-primary)]">검색어</span>
                  <input className="gov-input" placeholder="기관명 또는 사업자등록번호를 입력하세요" value={companyKeyword} onChange={(e) => setCompanyKeyword(e.target.value)} />
                </label>
                <MemberPermissionButton allowed={canUseCreate} className="min-w-[148px]" icon="search" onClick={() => void handleCompanySearch(1)} reason="관리자 생성 권한이 있어야 기관 검색을 사용할 수 있습니다." type="button" variant="primary">
                  {searchingCompanies ? "검색 중..." : "검색"}
                </MemberPermissionButton>
              </div>
              <div className="overflow-hidden rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)]">
                <table className="w-full text-sm">
                  <thead className="bg-[#f8f9fa] text-left">
                    <tr>
                      <th className="px-4 py-3">No.</th>
                      <th className="px-4 py-3">기관명</th>
                      <th className="px-4 py-3">사업자등록번호</th>
                      <th className="px-4 py-3">대표자</th>
                      <th className="px-4 py-3 text-center">선택</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredCompanyResults.length === 0 ? (
                      <tr>
                        <td className="px-4 py-10 text-center text-sm text-[var(--kr-gov-text-secondary)]" colSpan={5}>
                          {companyKeyword.trim() ? "검색 결과가 없습니다." : "선택 가능한 기관이 없습니다."}
                        </td>
                      </tr>
                    ) : filteredCompanyResults.map((item, idx) => (
                      <tr className="hover:bg-blue-50/40" key={item.insttId}>
                        <td className="px-4 py-4 text-[var(--kr-gov-text-secondary)]">{((companySearch?.page || 1) - 1) * (companySearch?.size || 5) + idx + 1}</td>
                        <td className="px-4 py-4 font-bold text-[var(--kr-gov-text-primary)]">{item.cmpnyNm}</td>
                        <td className="px-4 py-4 text-[var(--kr-gov-text-secondary)]">{item.bizrno}</td>
                        <td className="px-4 py-4 text-[var(--kr-gov-text-secondary)]">{item.cxfc}</td>
                        <td className="px-4 py-4 text-center">
                          <MemberPermissionButton allowed={canUseCreate} onClick={() => applyCompany(item)} reason="관리자 생성 권한이 있어야 기관을 선택할 수 있습니다." size="xs" type="button" variant="secondary">선택</MemberPermissionButton>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <nav aria-label="검색 결과 페이지" className={`${(companySearch?.totalPages || 0) > 1 ? "flex" : "hidden"} justify-center items-center gap-1 my-4`}>
                {Array.from({ length: Number(companySearch?.totalPages || 0) }, (_, idx) => idx + 1).map((pageIndex) => (
                  <button
                    className={`min-w-[36px] h-9 rounded border px-3 ${pageIndex === Number(companySearch?.page || 1) ? "border-[var(--kr-gov-blue)] bg-[var(--kr-gov-blue)] text-white" : "border-[var(--kr-gov-border-light)] bg-white text-[var(--kr-gov-text-secondary)]"}`}
                    key={pageIndex}
                    onClick={() => void handleCompanySearch(pageIndex)}
                    type="button"
                  >
                    {pageIndex}
                  </button>
                ))}
              </nav>
              <div className="bg-gray-50 border-t border-b border-gray-200 p-4 rounded-md">
                <p className="text-[13px] text-[var(--kr-gov-text-secondary)] flex items-center gap-1.5 leading-relaxed">
                  <span className="material-symbols-outlined text-blue-600 text-[18px]">info</span>
                  찾으시는 정보가 없는 경우 <a className="font-bold text-[var(--kr-gov-blue)] text-sm hover:underline" href={buildLocalizedPath("/admin/member/company_account", "/en/admin/member/company_account")}>[신규 회원사 등록]</a>을 진행해 주세요.
                </p>
              </div>
            </div>
          </div>
        </div>
      </CanView>
    </AdminPageShell>
  );
}
