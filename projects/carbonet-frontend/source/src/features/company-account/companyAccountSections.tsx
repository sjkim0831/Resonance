import type { ChangeEvent } from "react";
import { buildLocalizedPath } from "../../lib/navigation/runtime";
import { AdminInput, AdminRadio } from "../admin-ui/common";
import { MemberButton, MemberIconButton, MemberLinkButton, MEMBER_BUTTON_LABELS } from "../member/common";
import { MemberSectionCard } from "../member/sections";

export type CompanyFormState = {
  insttId: string;
  membershipType: string;
  agencyName: string;
  representativeName: string;
  bizRegistrationNumber: string;
  zipCode: string;
  companyAddress: string;
  companyAddressDetail: string;
  chargerName: string;
  chargerEmail: string;
  chargerTel: string;
};

export type UploadRow = {
  id: number;
  file: File | null;
};

export const MEMBERSHIP_CARD_OPTIONS = [
  {
    value: "E",
    icon: "factory",
    title: "CO2 배출사업자",
    description: "배출량 관리 및 상시 모니터링"
  },
  {
    value: "P",
    icon: "precision_manufacturing",
    title: "CCUS 프로젝트",
    description: "포집·저장·감축 프로젝트 수행"
  },
  {
    value: "C",
    icon: "domain",
    title: "진흥센터",
    description: "검증 및 운영 지원"
  },
  {
    value: "G",
    icon: "account_balance",
    title: "주무관청",
    description: "통계·정책 데이터 활용"
  }
] as const;

export function CompanyMembershipSection({
  form,
  canUse,
  updateField
}: {
  form: CompanyFormState;
  canUse: boolean;
  updateField: <K extends keyof CompanyFormState>(key: K, value: CompanyFormState[K]) => void;
}) {
  return (
    <section data-help-id="company-account-membership">
      <label className="block text-sm font-bold text-[var(--kr-gov-text-primary)] mb-4">회원 유형 선택 <span className="text-red-500">*</span></label>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {MEMBERSHIP_CARD_OPTIONS.map((option) => {
          const selected = form.membershipType === option.value;
          return (
            <label className={`border rounded-[var(--kr-gov-radius)] bg-white p-5 transition-all cursor-pointer ${selected ? "border-[var(--kr-gov-blue)] bg-blue-50 shadow-sm" : "border-[var(--kr-gov-border-light)]"}`} key={option.value}>
              <div className="mb-2 flex items-start justify-between">
                <span className={`material-symbols-outlined ${selected ? "text-[var(--kr-gov-blue)]" : ""}`}>{option.icon}</span>
                <AdminRadio checked={selected} className="w-4 h-4" disabled={!canUse} name="membershipType" onChange={() => updateField("membershipType", option.value)} />
              </div>
              <span className="block font-bold text-[15px] mb-1">{option.title}</span>
              <p className="text-[12px] text-gray-500 leading-snug">{option.description}</p>
            </label>
          );
        })}
      </div>
    </section>
  );
}

export function CompanyBusinessSection({
  form,
  isEditMode,
  canUseSave,
  nameCheckMessage,
  isNameChecked,
  updateField,
  handleCheckDuplicate,
  handleAddressSearch
}: {
  form: CompanyFormState;
  isEditMode: boolean;
  canUseSave: boolean;
  nameCheckMessage: string;
  isNameChecked: boolean;
  updateField: <K extends keyof CompanyFormState>(key: K, value: CompanyFormState[K]) => void;
  handleCheckDuplicate: () => Promise<void>;
  handleAddressSearch: () => void;
}) {
  return (
    <MemberSectionCard data-help-id="company-account-business" icon="business_center" title="사업자 정보">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-6">
        <div className="md:col-span-2">
          <label className="block text-sm font-bold text-[var(--kr-gov-text-primary)] mb-2">기관/기업명 <span className="text-red-500">*</span></label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <AdminInput className="min-w-0" disabled={!canUseSave || isEditMode} readOnly={isEditMode} value={form.agencyName} onChange={(e) => updateField("agencyName", e.target.value)} />
            {!isEditMode ? (
              <MemberButton
                className="w-full shrink-0 justify-center whitespace-nowrap sm:w-auto sm:min-w-[126px]"
                disabled={!canUseSave}
                onClick={() => void handleCheckDuplicate()}
                type="button"
                variant="primary"
              >
                {MEMBER_BUTTON_LABELS.duplicateCheck}
              </MemberButton>
            ) : null}
          </div>
          {nameCheckMessage ? (
            <p className={`mt-2 text-xs font-bold ${isNameChecked ? "text-emerald-600" : "text-red-600"}`}>{nameCheckMessage}</p>
          ) : null}
        </div>
        <label>
          <span className="block text-sm font-bold text-[var(--kr-gov-text-primary)] mb-2">대표자명 <span className="text-red-500">*</span></span>
          <AdminInput disabled={!canUseSave || isEditMode} readOnly={isEditMode} value={form.representativeName} onChange={(e) => updateField("representativeName", e.target.value)} />
        </label>
        <label>
          <span className="block text-sm font-bold text-[var(--kr-gov-text-primary)] mb-2">사업자등록번호 <span className="text-red-500">*</span></span>
          <AdminInput disabled={!canUseSave || isEditMode} inputMode="numeric" readOnly={isEditMode} value={form.bizRegistrationNumber} onChange={(e) => updateField("bizRegistrationNumber", e.target.value)} />
        </label>
        <div className="md:col-span-2">
          <label className="block text-sm font-bold text-[var(--kr-gov-text-primary)] mb-2">사업장 주소 <span className="text-red-500">*</span></label>
          <div className="mb-2 flex flex-col gap-2 sm:flex-row">
            <AdminInput className="w-full cursor-pointer bg-gray-50 sm:w-32" onClick={handleAddressSearch} placeholder="우편번호" readOnly value={form.zipCode} />
            <MemberButton
              className="w-full shrink-0 justify-center whitespace-nowrap sm:w-auto sm:min-w-[126px]"
              disabled={!canUseSave}
              onClick={handleAddressSearch}
              type="button"
              variant="secondary"
            >
              {MEMBER_BUTTON_LABELS.addressSearch}
            </MemberButton>
          </div>
          <AdminInput className="mb-2 cursor-pointer bg-gray-50" onClick={handleAddressSearch} placeholder="주소 검색 버튼을 눌러 기본 주소를 선택하세요" readOnly value={form.companyAddress} />
          <AdminInput disabled={!canUseSave} placeholder="상세 주소를 입력하세요" value={form.companyAddressDetail} onChange={(e) => updateField("companyAddressDetail", e.target.value)} />
        </div>
      </div>
    </MemberSectionCard>
  );
}

export function CompanyContactSection({
  form,
  canUseSave,
  updateField
}: {
  form: CompanyFormState;
  canUseSave: boolean;
  updateField: <K extends keyof CompanyFormState>(key: K, value: CompanyFormState[K]) => void;
}) {
  return (
    <MemberSectionCard data-help-id="company-account-contact" icon="person" title="담당자 정보">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-6">
        <label>
          <span className="block text-sm font-bold text-[var(--kr-gov-text-primary)] mb-2">담당자 성명 <span className="text-red-500">*</span></span>
          <AdminInput disabled={!canUseSave} value={form.chargerName} onChange={(e) => updateField("chargerName", e.target.value)} />
        </label>
        <label>
          <span className="block text-sm font-bold text-[var(--kr-gov-text-primary)] mb-2">이메일 주소 <span className="text-red-500">*</span></span>
          <AdminInput disabled={!canUseSave} type="text" value={form.chargerEmail} onChange={(e) => updateField("chargerEmail", e.target.value)} />
        </label>
        <label className="md:col-span-2">
          <span className="block text-sm font-bold text-[var(--kr-gov-text-primary)] mb-2">연락처 <span className="text-red-500">*</span></span>
          <AdminInput disabled={!canUseSave} type="text" value={form.chargerTel} onChange={(e) => updateField("chargerTel", e.target.value)} />
        </label>
      </div>
    </MemberSectionCard>
  );
}

export function CompanyFilesSection({
  uploadRows,
  canUseSave,
  handleFileChange,
  removeFileRow,
  addFileRow,
  formatBytes,
  fileRows
}: {
  uploadRows: UploadRow[];
  canUseSave: boolean;
  handleFileChange: (index: number, event: ChangeEvent<HTMLInputElement>) => void;
  removeFileRow: (index: number) => void;
  addFileRow: () => void;
  formatBytes: (bytes: number) => string;
  fileRows: Array<Record<string, unknown>>;
}) {
  return (
    <MemberSectionCard data-help-id="company-account-files" icon="upload_file" title="증빙 서류 제출">
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <label className="block text-sm font-bold text-[var(--kr-gov-text-primary)]">사업자등록증 또는 법인 검증 서류 <span className="text-red-500">*</span></label>
          <MemberButton
            className="w-full shrink-0 justify-center whitespace-nowrap sm:w-auto"
            disabled={!canUseSave}
            icon="add"
            onClick={addFileRow}
            size="xs"
            type="button"
            variant="secondary"
          >
            {MEMBER_BUTTON_LABELS.fileAdd}
          </MemberButton>
        </div>

        <div className="space-y-2">
          {uploadRows.map((row, index) => (
            <label className={`flex cursor-pointer items-center gap-3 rounded-lg border bg-white p-3 transition-all ${row.file ? "border-[var(--kr-gov-blue)] bg-blue-50/30" : "border-gray-200 hover:border-[var(--kr-gov-blue)]"}`} key={row.id}>
              <span className={`material-symbols-outlined ${row.file ? "text-[var(--kr-gov-blue)]" : "text-gray-400"}`}>attach_file</span>
              <div className="min-w-0 flex-grow">
                <input accept=".pdf,.jpg,.jpeg,.png" className="hidden" disabled={!canUseSave} onChange={(event) => handleFileChange(index, event)} type="file" />
                <div className="flex items-center justify-between gap-3">
                  <span className={`truncate text-sm ${row.file ? "font-bold text-[var(--kr-gov-blue)]" : "text-gray-500"}`}>
                    {row.file ? row.file.name : "파일을 선택해 주세요."}
                  </span>
                  <span className="text-xs text-gray-400">
                    {row.file ? formatBytes(row.file.size) : ""}
                  </span>
                </div>
              </div>
              <MemberIconButton
                className="border-0 bg-transparent text-gray-400 hover:bg-transparent hover:text-red-500"
                disabled={!canUseSave}
                icon="close"
                onClick={(event) => { event.preventDefault(); event.stopPropagation(); removeFileRow(index); }}
                size="icon"
                type="button"
                variant="ghost"
              />
            </label>
          ))}
        </div>

        <p className="text-xs text-gray-500">PDF, JPG, PNG 파일만 업로드 가능하며 파일당 최대 10MB까지 허용됩니다.</p>
        {fileRows.length > 0 ? (
          <div className="rounded-[var(--kr-gov-radius)] border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-xs font-bold text-[var(--kr-gov-text-secondary)]">기존 첨부 파일</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {fileRows.map((file, index) => (
                <MemberLinkButton className="rounded-full" href={buildLocalizedPath(`/admin/member/company-file?fileId=${encodeURIComponent(String(file.fileId || ""))}&download=true`, `/en/admin/member/company-file?fileId=${encodeURIComponent(String(file.fileId || ""))}&download=true`)} icon="download" key={`${String(file.fileId || "existing")}-${index}`} size="xs" variant="secondary">
                  {String(file.orignlFileNm || "첨부 파일")}
                </MemberLinkButton>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </MemberSectionCard>
  );
}
