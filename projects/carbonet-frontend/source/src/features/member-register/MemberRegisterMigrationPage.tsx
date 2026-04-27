import { FormEvent, useEffect, useMemo, useState } from "react";
import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { useFrontendSession } from "../../app/hooks/useFrontendSession";
import { logGovernanceScope } from "../../app/policy/debug";
import {
  checkMemberRegisterId,
  searchAdminCompanies
} from "../../lib/api/adminMember";
import { saveMemberRegister } from "../../lib/api/adminActions";
import type { AuthorGroup, AuthorGroupSection } from "../../lib/api/authTypes";
import { fetchMemberRegisterPage } from "../../lib/api/member";
import type { CompanySearchPayload, MemberRegisterPagePayload } from "../../lib/api/memberTypes";
import { CanView } from "../../components/access/CanView";
import { buildLocalizedPath, isEnglish } from "../../lib/navigation/runtime";
import { AdminPageShell } from "../admin-entry/AdminPageShell";
import { stringOf } from "../admin-system/adminSystemShared";
import { MemberActionBar, MemberPermissionButton, PageStatusNotice } from "../member/common";
import { AdminEditPageFrame } from "../admin-ui/pageFrames";

type RegisterFormState = {
  userName: string;
  userId: string;
  password: string;
  passwordConfirm: string;
  userEmail: string;
  userPhone: string;
  userType: string;
  insttId: string;
  orgName: string;
  orgBizNo: string;
  orgRepresentative: string;
  dept: string;
  authorCode: string;
  zip: string;
  adres: string;
  detailAdres: string;
};

const INITIAL_STATE: RegisterFormState = {
  userName: "",
  userId: "",
  password: "",
  passwordConfirm: "",
  userEmail: "",
  userPhone: "",
  userType: "",
  insttId: "",
  orgName: "",
  orgBizNo: "",
  orgRepresentative: "",
  dept: "",
  authorCode: "",
  zip: "",
  adres: "",
  detailAdres: ""
};

function mapEntrprsSeCodeToMemberType(entrprsSeCode: string): string {
  const normalized = String(entrprsSeCode || "").trim().toUpperCase();
  if (normalized === "E" || normalized === "P" || normalized === "C" || normalized === "G") {
    return normalized;
  }
  return "";
}

function membershipTypeRoleSuffix(memberType: string): string {
  const normalized = String(memberType || "").trim().toUpperCase();
  if (normalized === "E") {
    return "EMITTER";
  }
  if (normalized === "P") {
    return "PERFORMER";
  }
  if (normalized === "C") {
    return "CENTER";
  }
  if (normalized === "G") {
    return "GOV";
  }
  return "";
}

function membershipTypeLabel(memberType: string, en: boolean): string {
  const normalized = String(memberType || "").trim().toUpperCase();
  if (normalized === "E") {
    return en ? "CO2 Emitter" : "CO2 배출사업자";
  }
  if (normalized === "P") {
    return en ? "CCUS Project Operator" : "CCUS 프로젝트 사업자";
  }
  if (normalized === "C") {
    return en ? "Promotion / Support Institution" : "진흥·지원 기관";
  }
  if (normalized === "G") {
    return en ? "Related / Government Institution" : "관계 기관·주무관청";
  }
  return "";
}

function isMembershipSpecificUserRoleCode(authorCode: string): boolean {
  const normalized = String(authorCode || "").trim().toUpperCase();
  return normalized === "ROLE_USER_EMITTER"
    || normalized === "ROLE_USER_PERFORMER"
    || normalized === "ROLE_USER_CENTER"
    || normalized === "ROLE_USER_GOV"
    || normalized === "ROLE_USER_ENTERPRISE"
    || normalized === "ROLE_USER_AUTHORITY";
}

function buildMemberRegisterRoleSections(
  groups: AuthorGroup[],
  memberType: string,
  en: boolean
): AuthorGroupSection[] {
  const expectedSuffix = membershipTypeRoleSuffix(memberType);
  const baseGroups = groups.filter((group) => {
    const normalizedCode = String(group.authorCode || "").trim().toUpperCase();
    return !!expectedSuffix && normalizedCode === `ROLE_USER_${expectedSuffix}`;
  });
  const generalGroups = groups.filter((group) => {
    const normalizedCode = String(group.authorCode || "").trim().toUpperCase();
    if (isMembershipSpecificUserRoleCode(normalizedCode)) {
      return !expectedSuffix;
    }
    return true;
  });
  const sections: AuthorGroupSection[] = [];
  if (baseGroups.length > 0) {
    sections.push({
      layerKey: "BASE",
      sectionLabel: en ? "Type-based Member Roles" : "회원 유형 기준 권한 롤",
      groups: baseGroups
    });
  }
  if (generalGroups.length > 0) {
    sections.push({
      layerKey: "GENERAL",
      sectionLabel: en ? "General Member Roles" : "일반 권한 롤",
      groups: generalGroups
    });
  }
  return sections;
}

function text(en: boolean, ko: string, enText: string) {
  return en ? enText : ko;
}

function renderRoleProfilePreview(
  page: MemberRegisterPagePayload | null,
  profile?: { displayTitle?: string; priorityWorks?: string[]; description?: string; baseRoleYn?: string; assignmentScope?: string; defaultMemberTypes?: string[] }
) {
  if (!profile || (!profile.displayTitle && !(profile.priorityWorks || []).length && !profile.description && !profile.assignmentScope)) {
    return (
      <div className="mt-3 rounded-[var(--kr-gov-radius)] border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-[var(--kr-gov-text-secondary)]">
        {text(!!page?.isEn, "연결된 권한 프로필 정보가 없습니다.", "No linked role profile metadata.")}
      </div>
    );
  }
  return (
    <div className="mt-3 rounded-[var(--kr-gov-radius)] border border-blue-100 bg-blue-50 px-3 py-3 text-xs text-[var(--kr-gov-text-secondary)]">
      <p className="font-bold text-[var(--kr-gov-blue)]">{profile.displayTitle || "-"}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <span className="rounded-full bg-white px-2 py-0.5 font-bold text-[var(--kr-gov-blue)]">
          {profile.baseRoleYn === "Y" ? text(!!page?.isEn, "기본 롤", "Base role") : text(!!page?.isEn, "서브 롤", "Sub role")}
        </span>
        {profile.assignmentScope ? <span className="rounded-full bg-white px-2 py-0.5 font-bold text-[var(--kr-gov-blue)]">{profile.assignmentScope}</span> : null}
      </div>
      {(profile.priorityWorks || []).length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {(profile.priorityWorks || []).map((item) => (
            <span className="rounded-full bg-white px-2 py-0.5 font-bold text-[var(--kr-gov-blue)]" key={item}>{item}</span>
          ))}
        </div>
      ) : null}
      {(profile.defaultMemberTypes || []).length > 0 ? <p className="mt-2">{text(!!page?.isEn, "기본 회원 유형", "Default member types")}: {(profile.defaultMemberTypes || []).join(", ")}</p> : null}
      {profile.description ? <p className="mt-2">{profile.description}</p> : null}
    </div>
  );
}

let daumScriptLoaded = false;

export function MemberRegisterMigrationPage() {
  const en = isEnglish();
  const sessionState = useFrontendSession();
  const pageState = useAsyncValue<MemberRegisterPagePayload>(fetchMemberRegisterPage, []);
  const page = pageState.value;
  const [form, setForm] = useState(INITIAL_STATE);
  const [duplicateState, setDuplicateState] = useState<"idle" | "ok" | "error">("idle");
  const [orgSearchOpen, setOrgSearchOpen] = useState(false);
  const [orgKeyword, setOrgKeyword] = useState("");
  const [orgSearch, setOrgSearch] = useState<CompanySearchPayload | null>(null);
  const [orgSearchLoading, setOrgSearchLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const departmentRows = useMemo(
    () => ((page?.departmentMappings || []) as Array<Record<string, string>>)
      .filter((row) => stringOf(row, "insttId") === form.insttId),
    [page?.departmentMappings, form.insttId]
  );
  const roleOptionSections = useMemo(() => {
    const groups = ((page?.memberAssignableAuthorGroups || []) as AuthorGroup[])
      .map((group) => ({
        authorCode: String(group.authorCode || ""),
        authorNm: String(group.authorNm || ""),
        authorDc: String(group.authorDc || "")
      }))
      .filter((group) => {
        const normalizedCode = group.authorCode.trim().toUpperCase();
        return normalizedCode === "ROLE_USER"
          || normalizedCode.startsWith("ROLE_USER_")
          || normalizedCode.startsWith("ROLE_MEMBER_")
          || normalizedCode.startsWith("ROLE_ACCOUNT_");
      });
    return buildMemberRegisterRoleSections(groups, form.userType, en);
  }, [en, form.userType, page?.memberAssignableAuthorGroups]);
  const roleOptions = useMemo(
    () => roleOptionSections.flatMap((section) => section.groups),
    [roleOptionSections]
  );
  const selectedRoleProfile = ((page?.roleProfilesByAuthorCode || {}) as Record<string, { displayTitle?: string; priorityWorks?: string[]; description?: string }>)[form.authorCode];
  const selectedOrgSummary = useMemo(() => {
    if (!form.insttId || !form.orgName) {
      return null;
    }
    return [
      { label: en ? "Institution ID" : "기관 ID", value: form.insttId },
      { label: en ? "Business Number" : "사업자등록번호", value: form.orgBizNo || "-" },
      { label: en ? "Representative" : "대표자", value: form.orgRepresentative || "-" }
    ];
  }, [en, form.insttId, form.orgBizNo, form.orgName, form.orgRepresentative]);

  useEffect(() => {
    if (!page || !sessionState.value) {
      return;
    }
    logGovernanceScope("PAGE", "member-register", {
      route: window.location.pathname,
      actorUserId: sessionState.value.userId || "",
      actorAuthorCode: sessionState.value.authorCode || "",
      actorInsttId: sessionState.value.insttId || "",
      canManageAllCompanies: !!page.canManageAllCompanies,
      canManageOwnCompany: !!page.canManageOwnCompany,
      resolvedInsttId: String(page.currentUserInsttId || ""),
      selectedInsttId: form.insttId,
      selectedMemberType: form.userType
    });
    logGovernanceScope("COMPONENT", "member-register-role-select", {
      component: "member-register-role-select",
      roleSectionCount: roleOptionSections.length,
      roleOptionCount: roleOptions.length,
      selectedInsttId: form.insttId,
      selectedMemberType: form.userType
    });
  }, [form.insttId, form.userType, page, roleOptionSections.length, roleOptions.length, sessionState.value]);

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

  function update<K extends keyof RegisterFormState>(key: K, value: RegisterFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
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
      setError(en ? "Unable to load the address search tool." : "주소 검색 도구를 불러오지 못했습니다.");
      return;
    }
    new daum.Postcode({
      oncomplete: (data) => {
        const selectedAddress = data.userSelectedType === "R" ? (data.roadAddress || "") : (data.jibunAddress || "");
        setForm((current) => ({
          ...current,
          zip: String(data.zonecode || ""),
          adres: selectedAddress
        }));
        setError("");
      }
    }).open();
  }

  async function handleDuplicateCheck() {
    const normalized = form.userId.trim();
    logGovernanceScope("ACTION", "member-register-id-check", {
      userId: normalized,
      actorInsttId: sessionState.value?.insttId || "",
      resolvedInsttId: form.insttId || String(page?.currentUserInsttId || "")
    });
    if (!page?.canUseMemberRegisterIdCheck) {
      setError(en ? "You do not have permission to check duplicate IDs." : "아이디 중복 확인 권한이 없습니다.");
      return;
    }
    try {
      const result = await checkMemberRegisterId(normalized);
      setDuplicateState(result.duplicated ? "error" : "ok");
      setError("");
      setMessage(result.message);
    } catch (err) {
      setDuplicateState("error");
      setError(err instanceof Error ? err.message : (en ? "Failed to check the member ID." : "회원 ID 중복 확인에 실패했습니다."));
      setMessage("");
    }
  }

  async function handleSearchOrganization(pageIndex = 1) {
    logGovernanceScope("ACTION", "member-register-org-search", {
      keyword: orgKeyword.trim(),
      pageIndex,
      actorInsttId: sessionState.value?.insttId || "",
      resolvedInsttId: String(page?.currentUserInsttId || "")
    });
    if (!page?.canUseMemberRegisterOrgSearch) {
      setError(en ? "You do not have permission to search organizations." : "기관 검색 권한이 없습니다.");
      return;
    }
    const keyword = orgKeyword.trim();
    setError("");
    setOrgSearchLoading(true);
    try {
      const result = await searchAdminCompanies({ keyword, page: pageIndex, size: 5 });
      setOrgSearch(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : (en ? "Failed to search organizations." : "기관 검색에 실패했습니다."));
    } finally {
      setOrgSearchLoading(false);
    }
  }

  function applyOrganization(item: CompanySearchPayload["list"][number]) {
    const mappedMemberType = mapEntrprsSeCodeToMemberType(String(item.entrprsSeCode || ""));
    const nextDeptRows = ((page?.departmentMappings || []) as Array<Record<string, string>>)
      .filter((row) => stringOf(row, "insttId") === String(item.insttId || ""));
    const defaultDept = stringOf(nextDeptRows[0], "deptNm");
    setForm((current) => ({
      ...current,
      insttId: String(item.insttId || ""),
      orgName: String(item.cmpnyNm || ""),
      orgBizNo: String(item.bizrno || ""),
      orgRepresentative: String(item.cxfc || ""),
      userType: mappedMemberType || current.userType,
      dept: defaultDept,
      authorCode: ""
    }));
    setOrgSearchOpen(false);
  }

  function openOrganizationSearch() {
    setOrgSearchOpen(true);
    setError("");
    void handleSearchOrganization(1);
  }

  function handleDepartmentChange(nextDept: string) {
    setForm((current) => ({
      ...current,
      dept: nextDept
    }));
  }

  function resetForm() {
    setForm(INITIAL_STATE);
    setDuplicateState("idle");
    setMessage("");
    setError("");
    setOrgKeyword("");
    setOrgSearch(null);
  }

  async function submitRegister() {
    logGovernanceScope("ACTION", "member-register-save", {
      actorInsttId: sessionState.value?.insttId || "",
      selectedInsttId: form.insttId,
      selectedMemberType: form.userType,
      selectedAuthorCode: form.authorCode
    });
    if (!page?.canUseMemberRegisterSave) {
      setError(en ? "You do not have permission to save member registrations." : "회원 등록 저장 권한이 없습니다.");
      setMessage("");
      return;
    }
    const session = sessionState.value;
    if (!session) {
      setError(en ? "Session information is not available." : "세션 정보가 없습니다.");
      return;
    }
    if (duplicateState !== "ok") {
      setError(en ? "Please complete the duplicate ID check first." : "아이디 중복 확인을 먼저 완료해 주세요.");
      return;
    }
    if (!form.userName || !form.userId || !form.password || !form.passwordConfirm || !form.userEmail || !form.userPhone || !form.userType || !form.insttId || !form.orgName || !form.dept || !form.authorCode) {
      setError(en ? "Please complete all required fields." : "필수 항목을 모두 입력해주세요.");
      setMessage("");
      return;
    }

    try {
      const result = await saveMemberRegister(session, {
        memberId: form.userId,
        applcntNm: form.userName,
        password: form.password,
        passwordConfirm: form.passwordConfirm,
        applcntEmailAdres: form.userEmail,
        phoneNumber: form.userPhone,
        entrprsSeCode: form.userType,
        insttId: form.insttId,
        deptNm: form.dept,
        authorCode: form.authorCode,
        zip: form.zip,
        adres: form.adres,
        detailAdres: form.detailAdres
      });
      setError("");
      setMessage(text(en, `${result.memberId} 회원을 등록했습니다.`, `Member ${result.memberId} has been registered.`));
      setDuplicateState("idle");
    } catch (err) {
      setError(err instanceof Error ? err.message : (en ? "Failed to save the member registration." : "회원 등록 저장에 실패했습니다."));
      setMessage("");
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submitRegister();
  }

  return (
    <AdminPageShell
      breadcrumbs={[
        { label: en ? "Home" : "홈", href: buildLocalizedPath("/admin/", "/en/admin/") },
        { label: en ? "Member & Permission" : "회원·권한 관리" },
        { label: en ? "Register New Member" : "신규 회원 등록" }
      ]}
      title={en ? "Register New Member" : "신규 회원 등록"}
      subtitle={en ? "Register a new member with the company's department information and an assignable general authority role." : "회사 부서 정보와 현재 관리자가 부여 가능한 일반 권한 롤 범위 안에서 신규 회원을 등록합니다."}
    >
      {pageState.error || sessionState.error || error ? <PageStatusNotice tone="error">{error || sessionState.error || pageState.error}</PageStatusNotice> : null}
      {message ? <PageStatusNotice tone={duplicateState === "error" ? "error" : "success"}>{message}</PageStatusNotice> : null}

      <CanView
        allowed={pageState.loading || !!page?.canViewMemberRegister}
        fallback={<section className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white p-6 shadow-sm"><p className="text-sm text-[var(--kr-gov-text-secondary)]">{en ? "You do not have permission to view member registration." : "회원 등록 화면을 볼 권한이 없습니다."}</p></section>}
      >
        <AdminEditPageFrame>
          <form onSubmit={handleSubmit}>
            <section className="gov-card mb-8 border border-[var(--kr-gov-border-light)] bg-[linear-gradient(135deg,rgba(239,246,255,0.9),rgba(255,255,255,0.96))]">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--kr-gov-blue)]">{en ? "Registration Flow" : "등록 흐름"}</p>
                  <h3 className="mt-2 text-xl font-black text-[var(--kr-gov-text-primary)]">{en ? "Bind the institution first, then assign a member role." : "기관을 먼저 연결하고, 부여 가능한 일반 회원 권한 안에서 권한을 설정합니다."}</h3>
                  <p className="mt-3 text-sm leading-6 text-[var(--kr-gov-text-secondary)]">
                    {en
                      ? "The selected institution controls the member type, available department rows, and the role scope that the current administrator can actually grant."
                      : "선택한 기관을 기준으로 회원 유형과 부서 정보를 확인하고, 현재 로그인한 관리자가 실제로 줄 수 있는 일반 권한 롤 범위를 선택합니다."}
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[480px]">
                  <div className="rounded-[var(--kr-gov-radius)] border border-blue-100 bg-white px-4 py-3">
                    <p className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Institution" : "기관 연결"}</p>
                    <p className="mt-1 text-sm font-bold text-[var(--kr-gov-text-primary)]">{form.orgName || (en ? "Required" : "필수")}</p>
                  </div>
                  <div className="rounded-[var(--kr-gov-radius)] border border-blue-100 bg-white px-4 py-3">
                    <p className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Department" : "부서"}</p>
                    <p className="mt-1 text-sm font-bold text-[var(--kr-gov-text-primary)]">{form.dept || "-"}</p>
                  </div>
                  <div className="rounded-[var(--kr-gov-radius)] border border-blue-100 bg-white px-4 py-3">
                    <p className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">{en ? "Member Type" : "회원 유형"}</p>
                    <p className="mt-1 text-sm font-bold text-[var(--kr-gov-text-primary)]">{form.userType || "-"}</p>
                  </div>
                </div>
              </div>
            </section>

            <div className="grid grid-cols-1 gap-8 xl:grid-cols-[1.02fr_0.98fr]">
              <section className="gov-card" data-help-id="member-register-basic">
                <h3 className="mb-6 flex items-center gap-2 text-lg font-bold text-[var(--kr-gov-blue)]"><span className="material-symbols-outlined">account_circle</span>{en ? "Basic Information" : "기본 정보"}</h3>
                <div className="space-y-6">
                  <div>
                    <label className="form-label" htmlFor="user-name">{en ? "Full Name" : "성명"} <span className="required">*</span></label>
                    <input className="gov-input" id="user-name" placeholder={en ? "Enter full name" : "실명을 입력하세요"} value={form.userName} onChange={(event) => update("userName", event.target.value)} />
                  </div>
                  <div>
                    <label className="form-label" htmlFor="user-id">{en ? "Username" : "아이디"} <span className="required">*</span></label>
                    <div className="flex gap-2">
                      <input className="gov-input flex-1" id="user-id" placeholder={en ? "6-12 chars, alphanumeric" : "6~12자 영문, 숫자 조합"} value={form.userId} onChange={(event) => update("userId", event.target.value)} />
                      <MemberPermissionButton allowed={!!page?.canUseMemberRegisterIdCheck} onClick={() => void handleDuplicateCheck()} reason={en ? "Only authorized roles and members can check duplicate IDs." : "권한이 부여된 롤과 회원만 아이디 중복 확인을 사용할 수 있습니다."} type="button" variant="primary">{
                        en ? "Check Duplicates" : "중복 확인"
                      }</MemberPermissionButton>
                    </div>
                    {duplicateState === "ok" ? <p className="validation-msg success">{message || text(en, "사용 가능한 아이디입니다.", "This username is available.")}</p> : null}
                    {duplicateState === "error" && !error ? <p className="validation-msg error">{message || text(en, "이미 사용 중인 아이디입니다.", "This username is already in use.")}</p> : null}
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="form-label" htmlFor="user-password">{en ? "Password" : "비밀번호"} <span className="required">*</span></label>
                      <input className="gov-input" id="user-password" placeholder={en ? "Use letters, numbers, and symbols" : "영문, 숫자, 특수문자 포함"} type="password" value={form.password} onChange={(event) => update("password", event.target.value)} />
                    </div>
                    <div>
                      <label className="form-label" htmlFor="user-password-confirm">{en ? "Confirm Password" : "비밀번호 확인"} <span className="required">*</span></label>
                      <input className="gov-input" id="user-password-confirm" placeholder={en ? "Re-enter password" : "비밀번호를 다시 입력하세요"} type="password" value={form.passwordConfirm} onChange={(event) => update("passwordConfirm", event.target.value)} />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="form-label" htmlFor="user-email">{en ? "Email" : "이메일"} <span className="required">*</span></label>
                      <input className="gov-input" id="user-email" placeholder="example@domain.com" type="email" value={form.userEmail} onChange={(event) => update("userEmail", event.target.value)} />
                    </div>
                    <div>
                      <label className="form-label" htmlFor="user-phone">{en ? "Phone Number" : "연락처"} <span className="required">*</span></label>
                      <input className="gov-input" id="user-phone" placeholder="010-0000-0000" value={form.userPhone} onChange={(event) => update("userPhone", event.target.value)} />
                    </div>
                  </div>
                  <div>
                    <label className="form-label" htmlFor="user-zip">{en ? "Postal Code" : "우편번호"} <span className="required">*</span></label>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <input className="gov-input min-w-0 cursor-pointer bg-gray-50 sm:w-32" id="user-zip" onClick={handleAddressSearch} placeholder={en ? "Postal code" : "우편번호"} readOnly value={form.zip} />
                      <MemberPermissionButton allowed={!!page?.canUseMemberRegisterSave} className="shrink-0 whitespace-nowrap sm:min-w-[126px]" icon="search" onClick={handleAddressSearch} reason={en ? "Only authorized roles and members can search addresses." : "권한이 부여된 롤과 회원만 주소 검색을 사용할 수 있습니다."} type="button" variant="secondary">
                        {en ? "Search Address" : "주소 검색"}
                      </MemberPermissionButton>
                    </div>
                  </div>
                  <div>
                    <label className="form-label" htmlFor="user-address">{en ? "Address" : "주소"} <span className="required">*</span></label>
                    <input className="gov-input cursor-pointer bg-gray-50" id="user-address" onClick={handleAddressSearch} placeholder={en ? "Click to choose base address" : "주소 검색 버튼을 눌러 기본 주소를 선택하세요"} readOnly value={form.adres} />
                  </div>
                  <div>
                    <label className="form-label" htmlFor="user-address-detail">{en ? "Detail Address" : "상세 주소"}</label>
                    <input className="gov-input" id="user-address-detail" placeholder={en ? "Apartment, floor, office, etc." : "상세 주소를 입력하세요"} value={form.detailAdres} onChange={(event) => update("detailAdres", event.target.value)} />
                  </div>
                  <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-slate-50 px-4 py-4">
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--kr-gov-blue)]">{en ? "Member Type" : "회원 유형"}</p>
                    <p className="mt-2 text-base font-bold text-[var(--kr-gov-text-primary)]">{membershipTypeLabel(form.userType, en) || (en ? "Follows selected institution" : "선택 기관 기준")}</p>
                    <p className="mt-2 text-xs text-[var(--kr-gov-text-secondary)]">{text(en, "Member type is derived automatically from the selected institution and cannot be edited manually here.", "회원 유형은 선택한 기관의 유형을 자동으로 따르며 이 화면에서 수동 변경할 수 없습니다.")}</p>
                  </div>
                </div>
              </section>

              <section className="gov-card" data-help-id="member-register-affiliation">
                <h3 className="mb-6 flex items-center gap-2 text-lg font-bold text-[var(--kr-gov-blue)]"><span className="material-symbols-outlined">badge</span>{en ? "Affiliation & Role Scope" : "소속 및 권한 범위"}</h3>
                <div className="space-y-6">
                  <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-[#f8fafc] p-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--kr-gov-blue)]">{en ? "Institution Search" : "기관 검색"}</p>
                        <p className="mt-2 text-sm leading-6 text-[var(--kr-gov-text-secondary)]">
                          {en
                            ? "Search the target company first. Its member type and grantable member roles become the baseline for available selections."
                            : "대상 회사를 먼저 검색하세요. 선택한 회사의 회원 유형과 부여 가능한 일반 회원 권한이 이 화면의 선택 기준이 됩니다."}
                        </p>
                      </div>
                      <MemberPermissionButton allowed={!!page?.canUseMemberRegisterOrgSearch} icon="search" onClick={openOrganizationSearch} reason={en ? "Only authorized roles and members can search organizations." : "권한이 부여된 롤과 회원만 기관 검색을 사용할 수 있습니다."} type="button" variant="secondary">{en ? "Search Organization" : "기관 검색"}</MemberPermissionButton>
                    </div>
                  </div>
                  <div>
                    <label className="form-label" htmlFor="org-name">{en ? "Organization / Company Name" : "소속 기관/기업명"} <span className="required">*</span></label>
                    <input className="gov-input bg-gray-50" id="org-name" placeholder={en ? "Select organization from search dialog" : "기관 검색으로 소속 기관을 선택해 주세요"} readOnly value={form.orgName} />
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
                      {en ? "No institution selected yet. Open the search dialog and choose an institution before saving." : "아직 연결된 기관이 없습니다. 기관 검색 창에서 소속 기관을 선택한 뒤 저장하세요."}
                    </div>
                  )}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="form-label" htmlFor="instt-id">{en ? "Institution ID" : "기관 ID"} <span className="required">*</span></label>
                      <input className="gov-input bg-gray-50" id="instt-id" readOnly value={form.insttId} />
                    </div>
                    <div>
                      <label className="form-label" htmlFor="org-bizno">{en ? "Business Number" : "사업자등록번호"}</label>
                      <input className="gov-input bg-gray-50" id="org-bizno" readOnly value={form.orgBizNo} />
                    </div>
                  </div>
                  <div>
                    <label className="form-label" htmlFor="dept">{en ? "Department" : "부서"} <span className="required">*</span></label>
                    {departmentRows.length > 0 ? (
                      <select className="gov-select" id="dept" value={form.dept} onChange={(event) => handleDepartmentChange(event.target.value)}>
                        <option value="">{en ? "Select Department" : "부서를 선택하세요"}</option>
                        {departmentRows.map((row) => (
                          <option key={`${stringOf(row, "insttId")}:${stringOf(row, "deptNm")}`} value={stringOf(row, "deptNm")}>
                            {stringOf(row, "deptNm")}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input className="gov-input" id="dept" placeholder={en ? "Department Name" : "부서명"} value={form.dept} onChange={(event) => update("dept", event.target.value)} />
                    )}
                    <p className="mt-2 text-xs text-[var(--kr-gov-text-secondary)]">
                      {departmentRows.length > 0
                        ? text(en, "검색된 회사의 신청 가능 부서 롤을 기준으로 부서를 선택합니다.", "Select a department from the searched company's applicable department-role mappings.")
                        : text(en, "이 회사에 등록된 부서 롤 맵핑이 없어 직접 부서를 입력해야 합니다.", "No department-role mapping was found for this company, so enter the department manually.")}
                    </p>
                  </div>
                  <div>
                    <label className="form-label" htmlFor="author-code">{en ? "System Access Role" : "시스템 접근 권한 설정"} <span className="required">*</span></label>
                    <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-gray-50 p-4">
                      <p className="mb-3 text-[12px] text-gray-500">
                        {en
                          ? "Choose a general role within the current administrator's grantable scope."
                          : "현재 로그인한 관리자가 줄 수 있는 일반 권한 롤 범위 안에서 선택합니다."}
                      </p>
                      <select className="gov-select bg-white" id="author-code" value={form.authorCode} onChange={(event) => update("authorCode", event.target.value)}>
                        <option value="">{en ? "Select Role" : "권한 롤을 선택하세요"}</option>
                        {roleOptionSections.length > 0 ? roleOptionSections.map((section) => (
                          <optgroup key={section.layerKey} label={section.sectionLabel}>
                            {section.groups.map((option) => (
                              <option key={option.authorCode} value={option.authorCode}>
                                {option.authorNm} ({option.authorCode})
                              </option>
                            ))}
                          </optgroup>
                        )) : roleOptions.map((option) => (
                          <option key={option.authorCode} value={option.authorCode}>
                            {option.authorNm} ({option.authorCode})
                          </option>
                        ))}
                      </select>
                      {renderRoleProfilePreview(page, selectedRoleProfile)}
                    </div>
                  </div>
                </div>
              </section>
            </div>

            <div data-help-id="member-register-actions">
              <MemberActionBar
                dataHelpId="member-register-actions"
                description={en ? "Review the institution, department, and role scope before saving the member." : "기관, 부서, 권한 범위를 확인한 뒤 회원 등록을 저장하세요."}
                eyebrow={en ? "Registration Actions" : "등록 작업"}
                primary={<MemberPermissionButton allowed={!!page?.canUseMemberRegisterSave} className="w-full justify-center whitespace-nowrap shadow-lg shadow-blue-900/10 sm:w-auto sm:min-w-[220px]" reason={en ? "Only authorized roles and members can complete member registration." : "권한이 부여된 롤과 회원만 신규 회원 등록을 완료할 수 있습니다."} size="lg" type="submit" variant="primary">{en ? "Complete Registration" : "등록 완료"}</MemberPermissionButton>}
                secondary={{ href: buildLocalizedPath("/admin/member/list", "/en/admin/member/list"), icon: "list", label: en ? "List" : "목록" }}
                tertiary={{ icon: "refresh", label: en ? "Reset" : "초기화", onClick: resetForm }}
                title={en ? "Check the organization binding, department role, and assignable scope before saving." : "기관 연결, 부서 롤, 부여 가능 범위를 확인한 뒤 저장하세요."}
              />
            </div>
          </form>
        </AdminEditPageFrame>
      </CanView>

      <div aria-labelledby="member-register-org-search-title" aria-modal="true" className={`${orgSearchOpen ? "fixed" : "hidden"} inset-0 z-[1000] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm`} data-help-id="member-register-org-search-title" role="dialog">
        <div className="w-full max-w-[960px] overflow-hidden rounded-[calc(var(--kr-gov-radius)+8px)] bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-[var(--kr-gov-border-light)] px-6 py-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--kr-gov-blue)]">{en ? "Institution Search" : "기관 검색"}</p>
              <h3 className="mt-1 text-lg font-black" id="member-register-org-search-title">{en ? "Search and select an institution" : "기관을 검색하고 선택하세요."}</h3>
            </div>
            <button className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--kr-gov-border-light)] text-[var(--kr-gov-text-secondary)] hover:bg-gray-50" onClick={() => setOrgSearchOpen(false)} type="button">
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
          <div className="space-y-5 px-6 py-6">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
              <label>
                <span className="mb-2 block text-sm font-bold text-[var(--kr-gov-text-primary)]">{en ? "Keyword" : "검색어"}</span>
                <input className="gov-input" placeholder={en ? "Enter institution name or business number" : "기관명 또는 사업자등록번호를 입력하세요"} value={orgKeyword} onChange={(event) => setOrgKeyword(event.target.value)} />
              </label>
              <MemberPermissionButton allowed={!!page?.canUseMemberRegisterOrgSearch} className="min-w-[148px]" icon="search" onClick={() => void handleSearchOrganization(1)} reason={en ? "Only authorized roles and members can search organizations." : "권한이 부여된 롤과 회원만 기관 검색을 사용할 수 있습니다."} type="button" variant="primary">
                {orgSearchLoading ? (en ? "Searching..." : "검색 중...") : (en ? "Search" : "검색")}
              </MemberPermissionButton>
            </div>
            <div className="overflow-hidden rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)]">
              <table className="w-full text-sm">
                <thead className="bg-[#f8f9fa] text-left">
                  <tr>
                    <th className="px-4 py-3">No.</th>
                    <th className="px-4 py-3">{en ? "Institution" : "기관명"}</th>
                    <th className="px-4 py-3">{en ? "Business Number" : "사업자등록번호"}</th>
                    <th className="px-4 py-3">{en ? "Representative" : "대표자"}</th>
                    <th className="px-4 py-3 text-center">{en ? "Action" : "선택"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(orgSearch?.list || []).length === 0 ? (
                    <tr>
                      <td className="px-4 py-10 text-center text-sm text-[var(--kr-gov-text-secondary)]" colSpan={5}>
                        {orgKeyword.trim()
                          ? (en ? "No matching institutions were found." : "검색 결과가 없습니다.")
                          : (en ? "No institutions are available to select." : "선택 가능한 기관이 없습니다.")}
                      </td>
                    </tr>
                  ) : (orgSearch?.list || []).map((item, index) => (
                    <tr className="hover:bg-blue-50/40" key={item.insttId}>
                      <td className="px-4 py-4 text-[var(--kr-gov-text-secondary)]">{((orgSearch?.page || 1) - 1) * (orgSearch?.size || 5) + index + 1}</td>
                      <td className="px-4 py-4 font-bold text-[var(--kr-gov-text-primary)]">{item.cmpnyNm}</td>
                      <td className="px-4 py-4 text-[var(--kr-gov-text-secondary)]">{item.bizrno}</td>
                      <td className="px-4 py-4 text-[var(--kr-gov-text-secondary)]">{item.cxfc}</td>
                      <td className="px-4 py-4 text-center">
                        <MemberPermissionButton allowed={!!page?.canUseMemberRegisterOrgSearch} onClick={() => applyOrganization(item)} reason={en ? "Only authorized roles and members can select institutions." : "권한이 부여된 롤과 회원만 기관을 선택할 수 있습니다."} size="xs" type="button" variant="secondary">{en ? "Select" : "선택"}</MemberPermissionButton>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className={`${(orgSearch?.totalPages || 0) > 1 ? "flex" : "hidden"} items-center justify-center gap-1`}>
              {Array.from({ length: Number(orgSearch?.totalPages || 0) }, (_, index) => index + 1).map((pageNumber) => (
                <button
                  className={`min-w-[36px] rounded border px-3 py-2 text-sm ${pageNumber === Number(orgSearch?.page || 1) ? "border-[var(--kr-gov-blue)] bg-[var(--kr-gov-blue)] text-white" : "border-[var(--kr-gov-border-light)] bg-white text-[var(--kr-gov-text-secondary)]"}`}
                  key={pageNumber}
                  onClick={() => void handleSearchOrganization(pageNumber)}
                  type="button"
                >
                  {pageNumber}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AdminPageShell>
  );
}
