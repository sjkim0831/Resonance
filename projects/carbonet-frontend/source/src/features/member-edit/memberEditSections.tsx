import { useState, type Dispatch, type SetStateAction } from "react";
import type { MemberEditPagePayload } from "../../lib/api/memberTypes";
import { AdminCheckbox, AdminInput, AdminSelect, AdminTextarea } from "../admin-ui/common";
import { MemberLinkButton, MEMBER_BUTTON_LABELS } from "../member/common";
import { MemberInsetNotice, MemberSectionCard } from "../member/sections";

export type MemberEditFormState = {
  memberId: string;
  applcntNm: string;
  applcntEmailAdres: string;
  phoneNumber: string;
  entrprsSeCode: string;
  entrprsMberSttus: string;
  authorCode: string;
  zip: string;
  adres: string;
  detailAdres: string;
  marketingYn: string;
  deptNm: string;
};

export function renderPermissionChip(type: "add" | "remove" | "base" | null) {
  if (type === "add") {
    return <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-bold bg-emerald-100 text-emerald-700">추가</span>;
  }
  if (type === "remove") {
    return <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-bold bg-red-100 text-red-700">제외</span>;
  }
  if (type === "base") {
    return <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-bold bg-slate-100 text-slate-700">기본</span>;
  }
  return null;
}

export function MemberEditSummarySection({
  form,
  page,
  businessRoleLabel,
  businessRoleDescription,
  membershipTypeLabel,
  statusLabel,
  memberDocumentStatusLabel,
  accessScopes,
  institutionInsttId,
  institutionStatusLabel,
  documentStatusLabel
}: {
  form: MemberEditFormState;
  page: MemberEditPagePayload | null;
  businessRoleLabel: string;
  businessRoleDescription: string;
  membershipTypeLabel: string;
  statusLabel: string;
  memberDocumentStatusLabel: string;
  accessScopes: string[];
  institutionInsttId: string;
  institutionStatusLabel: string;
  documentStatusLabel: string;
}) {
  return (
    <section className="border border-[var(--kr-gov-border-light)] rounded-[var(--kr-gov-radius)] bg-white p-6 shadow-sm xl:col-span-1 space-y-5" data-help-id="member-edit-summary">
      <div className="flex items-center gap-2 border-b pb-4">
        <span className="material-symbols-outlined text-[var(--kr-gov-blue)]">assignment_ind</span>
        <h3 className="text-lg font-bold">계정 요약</h3>
      </div>
      <div>
        <label className="block text-[14px] font-bold text-[var(--kr-gov-text-primary)] mb-2">회원 ID</label>
        <AdminInput className="h-11 bg-gray-50 text-gray-600" readOnly type="text" value={form.memberId} />
      </div>
      <div>
        <label className="block text-[14px] font-bold text-[var(--kr-gov-text-primary)] mb-2">가입일</label>
        <AdminInput className="h-11 bg-gray-50 text-gray-600" readOnly type="text" value={String((page?.member as Record<string, unknown> | undefined)?.sbscrbDe || "-")} />
      </div>
      <div data-help-id="member-edit-role-profile">
        <label className="block text-[14px] font-bold text-[var(--kr-gov-text-primary)] mb-2">업무 역할</label>
        <div className="rounded-[var(--kr-gov-radius)] bg-blue-50 border border-blue-100 px-4 py-3">
          <p className="text-sm font-bold text-[var(--kr-gov-blue)]">{businessRoleLabel}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {String(((page as Record<string, unknown> | null)?.assignedRoleProfile as Record<string, unknown> | undefined)?.baseRoleYn || "") === "Y" ? (
              <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-[var(--kr-gov-blue)]">기본 롤</span>
            ) : null}
            {String(((page as Record<string, unknown> | null)?.assignedRoleProfile as Record<string, unknown> | undefined)?.assignmentScope || "") ? (
              <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-[var(--kr-gov-blue)]">
                {String((((page as Record<string, unknown> | null)?.assignedRoleProfile as Record<string, unknown> | undefined)?.assignmentScope || ""))}
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-xs text-slate-600">{businessRoleDescription}</p>
        </div>
      </div>
      <div>
        <label className="block text-[14px] font-bold text-[var(--kr-gov-text-primary)] mb-2">계정 상태</label>
        <div className="rounded-[var(--kr-gov-radius)] bg-slate-50 px-4 py-3 text-sm">
          <p><span className="font-bold">회원 유형:</span> {membershipTypeLabel}</p>
          <p className="mt-1"><span className="font-bold">회원 상태:</span> {statusLabel}</p>
          <p className="mt-1"><span className="font-bold">회원 제출 문서:</span> {memberDocumentStatusLabel}</p>
        </div>
      </div>
      <div data-help-id="member-edit-role-profile">
        <label className="block text-[14px] font-bold text-[var(--kr-gov-text-primary)] mb-2">우선 제공 업무</label>
        <div className="flex flex-wrap gap-2">
          {accessScopes.length === 0 ? <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">-</span> : accessScopes.map((scope) => (
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700" key={scope}>{scope}</span>
          ))}
        </div>
      </div>
      {institutionInsttId ? (
        <div>
          <label className="block text-[14px] font-bold text-[var(--kr-gov-text-primary)] mb-2">회원사 참조 정보</label>
          <div className="rounded-[var(--kr-gov-radius)] bg-gray-50 px-4 py-3 text-sm text-[var(--kr-gov-text-secondary)]">
            <p><span className="font-bold text-[var(--kr-gov-text-primary)]">기관 승인 상태:</span> {institutionStatusLabel}</p>
            <p className="mt-1"><span className="font-bold text-[var(--kr-gov-text-primary)]">증빙 문서 상태:</span> {documentStatusLabel}</p>
            <p className="mt-1"><span className="font-bold text-[var(--kr-gov-text-primary)]">기관 ID:</span> {institutionInsttId}</p>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export function MemberEditMainSections({
  page,
  form,
  setForm,
  canUse,
  text,
  permissionSelectedAuthorName,
  permissionFeatureCount,
  permissionPageCount,
  featureCodes,
  toggleFeature,
  resolvePermissionChipType,
  memberEvidenceFiles
}: {
  page: MemberEditPagePayload | null;
  form: MemberEditFormState;
  setForm: Dispatch<SetStateAction<MemberEditFormState>>;
  canUse: boolean;
  text: (page: MemberEditPagePayload | null, ko: string, en: string) => string;
  permissionSelectedAuthorName: string;
  permissionFeatureCount: number;
  permissionPageCount: number;
  featureCodes: string[];
  toggleFeature: (code: string) => void;
  resolvePermissionChipType: (featureCode: string) => "add" | "remove" | "base" | null;
  memberEvidenceFiles: Array<Record<string, unknown>>;
}) {
  const [permissionSectionOpen, setPermissionSectionOpen] = useState(false);

  return (
    <div className="xl:col-span-2 space-y-6">
      <MemberSectionCard data-help-id="member-edit-form" icon="person" title="회원 기본 정보">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <label>
            <span className="block text-[14px] font-bold text-[var(--kr-gov-text-primary)] mb-2">회원명 <span className="text-[var(--kr-gov-error)]">*</span></span>
            <AdminInput disabled={!canUse} value={form.applcntNm} onChange={(e) => setForm({ ...form, applcntNm: e.target.value })} />
          </label>
          <label>
            <span className="block text-[14px] font-bold text-[var(--kr-gov-text-primary)] mb-2">이메일 <span className="text-[var(--kr-gov-error)]">*</span></span>
            <AdminInput disabled={!canUse} value={form.applcntEmailAdres} onChange={(e) => setForm({ ...form, applcntEmailAdres: e.target.value })} />
          </label>
          <label>
            <span className="block text-[14px] font-bold text-[var(--kr-gov-text-primary)] mb-2">연락처 <span className="text-[var(--kr-gov-error)]">*</span></span>
            <AdminInput disabled={!canUse} value={form.phoneNumber} onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })} />
          </label>
          <label>
            <span className="block text-[14px] font-bold text-[var(--kr-gov-text-primary)] mb-2">부서명</span>
            <AdminInput disabled={!canUse} value={form.deptNm} onChange={(e) => setForm({ ...form, deptNm: e.target.value })} />
          </label>
          <label>
            <span className="block text-[14px] font-bold text-[var(--kr-gov-text-primary)] mb-2">회원 유형 <span className="text-[var(--kr-gov-error)]">*</span></span>
            <AdminSelect disabled={!canUse} value={form.entrprsSeCode} onChange={(e) => setForm({ ...form, entrprsSeCode: e.target.value })}>
              {((page?.memberTypeOptions as Array<{ code: string; label: string }>) || []).map((opt) => <option key={opt.code} value={opt.code}>{opt.label}</option>)}
            </AdminSelect>
          </label>
          <label>
            <span className="block text-[14px] font-bold text-[var(--kr-gov-text-primary)] mb-2">회원 상태 <span className="text-[var(--kr-gov-error)]">*</span></span>
            <AdminSelect disabled={!canUse} value={form.entrprsMberSttus} onChange={(e) => setForm({ ...form, entrprsMberSttus: e.target.value })}>
              {((page?.memberStatusOptions as Array<{ code: string; label: string }>) || []).map((opt) => <option key={opt.code} value={opt.code}>{opt.label}</option>)}
            </AdminSelect>
          </label>
          <label className="md:col-span-2 inline-flex items-center gap-3 text-sm font-medium cursor-pointer">
            <AdminCheckbox checked={form.marketingYn === "Y"} className="h-4 w-4 border-gray-300" disabled={!canUse} onChange={(e) => setForm({ ...form, marketingYn: e.target.checked ? "Y" : "N" })} />
            마케팅 정보 수신 동의
          </label>
        </div>
      </MemberSectionCard>

      <MemberSectionCard data-help-id="member-edit-permissions" icon="shield" title="권한 롤 및 개별 권한">
        <div className="space-y-4">
          <button
            aria-expanded={permissionSectionOpen}
            className="flex w-full items-center justify-between rounded-[var(--kr-gov-radius)] border border-slate-200 bg-slate-50 px-4 py-3 text-left transition-colors hover:bg-slate-100"
            onClick={() => setPermissionSectionOpen((current) => !current)}
            type="button"
          >
            <div>
              <p className="text-sm font-bold text-[var(--kr-gov-text-primary)]">권한 롤 및 개별 권한 설정</p>
              <p className="mt-1 text-xs text-slate-500">
                {permissionSectionOpen
                  ? "권한 롤 선택과 개별 권한 체크 목록을 접습니다."
                  : "기본은 접힌 상태이며, 열면 권한 롤과 개별 권한을 수정할 수 있습니다."}
              </p>
            </div>
            <span className="material-symbols-outlined text-slate-500">
              {permissionSectionOpen ? "expand_less" : "expand_more"}
            </span>
          </button>

          {permissionSectionOpen ? (
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label>
                    <span className="block text-[14px] font-bold text-[var(--kr-gov-text-primary)] mb-2">기준 권한 롤 <span className="text-[var(--kr-gov-error)]">*</span></span>
                    <AdminSelect disabled={!canUse} value={form.authorCode} onChange={(e) => setForm({ ...form, authorCode: e.target.value })}>
                      <option value="">권한 롤 선택</option>
                      {((page as Record<string, unknown> | null)?.permissionAuthorGroupSections as Array<Record<string, unknown>> | undefined)?.length ? (
                        (((page as Record<string, unknown> | null)?.permissionAuthorGroupSections as Array<Record<string, unknown>> | undefined) || []).map((section, sectionIndex) => (
                          <optgroup key={`${String(section.sectionLabel || "section")}-${sectionIndex}`} label={String(section.sectionLabel || "")}>
                            {((section.groups as Array<{ authorCode: string; authorNm: string }> | undefined) || []).map((group) => (
                              <option key={group.authorCode} value={group.authorCode}>{group.authorNm} ({group.authorCode})</option>
                            ))}
                          </optgroup>
                        ))
                      ) : (
                        (page?.permissionAuthorGroups || []).map((group) => (
                          <option key={group.authorCode} value={group.authorCode}>{group.authorNm} ({group.authorCode})</option>
                        ))
                      )}
                    </AdminSelect>
                  </label>
                  <p className="mt-2 text-xs text-slate-500">{text(page, "롤 기본 권한을 기준으로 체크가 구성되며, 아래에서 회원별 추가/제외 권한을 직접 조정할 수 있습니다.", "Checkboxes start from the role baseline, and member-specific additions or removals can be adjusted below.")}</p>
                </div>
                <div className="rounded-[var(--kr-gov-radius)] border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                  <p><span className="font-bold">선택 롤:</span> {permissionSelectedAuthorName}</p>
                  <p className="mt-1"><span className="font-bold">최종 권한 수:</span> {permissionFeatureCount}</p>
                  <p className="mt-1"><span className="font-bold">대상 메뉴 수:</span> {permissionPageCount}</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 text-xs">
                <span className="inline-flex items-center rounded-full px-3 py-1 font-bold bg-slate-100 text-slate-700">기본 롤 권한</span>
                <span className="inline-flex items-center rounded-full px-3 py-1 font-bold bg-emerald-100 text-emerald-700">회원별 추가 권한</span>
                <span className="inline-flex items-center rounded-full px-3 py-1 font-bold bg-red-100 text-red-700">회원별 제외 권한</span>
              </div>

              <div className="space-y-4">
                {(page?.permissionFeatureSections || []).map((section) => (
                  <section className="rounded-[var(--kr-gov-radius)] border border-slate-200" key={section.menuCode}>
                    <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
                      <div>
                        <h4 className="text-sm font-bold text-[var(--kr-gov-text-primary)]">{section.menuNm || section.menuNmEn || section.menuCode}</h4>
                        <p className="mt-1 text-xs text-slate-500">{section.menuUrl || "연결 URL 없음"}</p>
                      </div>
                      <span className="text-xs font-bold text-slate-500">{section.features.length}개 기능</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4">
                      {section.features.map((feature) => {
                        const chipType = resolvePermissionChipType(feature.featureCode);
                        return (
                          <label className="flex items-start gap-3 rounded-[var(--kr-gov-radius)] border border-slate-200 bg-white px-4 py-3" key={feature.featureCode}>
                            <AdminCheckbox checked={featureCodes.includes(feature.featureCode)} className="mt-1 h-4 w-4 border-gray-300" disabled={!canUse} onChange={() => toggleFeature(feature.featureCode)} />
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm font-bold text-[var(--kr-gov-text-primary)]">{feature.featureNm || feature.featureCode}</span>
                                {renderPermissionChip(chipType)}
                              </div>
                              <p className="mt-1 text-xs text-slate-500">{feature.featureCode}</p>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </MemberSectionCard>

      <MemberSectionCard data-help-id="member-edit-address" icon="location_on" iconClassName="text-[var(--kr-gov-green)]" title="연락 및 제출 주소">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <label>
            <span className="block text-[14px] font-bold text-[var(--kr-gov-text-primary)] mb-2">우편번호</span>
            <AdminInput disabled={!canUse} value={form.zip} onChange={(e) => setForm({ ...form, zip: e.target.value })} />
          </label>
          <label>
            <span className="block text-[14px] font-bold text-[var(--kr-gov-text-primary)] mb-2">상세주소</span>
            <AdminInput disabled={!canUse} value={form.detailAdres} onChange={(e) => setForm({ ...form, detailAdres: e.target.value })} />
          </label>
          <label className="md:col-span-2">
            <span className="block text-[14px] font-bold text-[var(--kr-gov-text-primary)] mb-2">기본주소</span>
            <AdminTextarea className="min-h-[96px]" disabled={!canUse} value={form.adres} onChange={(e) => setForm({ ...form, adres: e.target.value })} />
          </label>
          <MemberInsetNotice className="md:col-span-2">{text(page, "이 영역은 회원 테이블의 연락/제출 주소입니다. 회원사 주소와 별도로 관리됩니다.", "This area stores contact and submission addresses on the member record, separate from company addresses.")}</MemberInsetNotice>
        </div>
      </MemberSectionCard>

      <MemberSectionCard data-help-id="member-edit-evidence" icon="description" title="회원 제출 증빙 문서">
        <div className="space-y-3">
          {memberEvidenceFiles.length === 0 ? (
            <div className="rounded-[var(--kr-gov-radius)] border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">{text(page, "회원 테이블에 등록된 증빙 문서가 없습니다.", "No evidence files are registered on the member record.")}</div>
          ) : memberEvidenceFiles.map((file, index) => (
            <div className="rounded-[var(--kr-gov-radius)] border border-slate-200 bg-slate-50 px-4 py-3" key={`${String(file.fileId || file.fileName || "file")}-${index}`}>
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-[var(--kr-gov-text-primary)]">{String(file.fileName || "-")}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    <span>DB 파일명: {String(file.storedFileName || "-")}</span>
                    <span className="mx-2">|</span>
                    <span>파일 ID: {String(file.fileId || "-")}</span>
                    <span className="mx-2">|</span>
                    <span>등록일: {String(file.regDate || "-")}</span>
                  </p>
                </div>
                <div className="flex gap-2">
                  {file.previewUrl ? <MemberLinkButton href={String(file.previewUrl)} size="xs" target="_blank" variant="secondary">{MEMBER_BUTTON_LABELS.preview}</MemberLinkButton> : null}
                  {file.downloadUrl ? <MemberLinkButton href={String(file.downloadUrl)} size="xs" variant="secondary">{MEMBER_BUTTON_LABELS.download}</MemberLinkButton> : null}
                  {!file.previewUrl && !file.downloadUrl ? <span className="px-3 py-1.5 text-[12px] font-bold border border-dashed border-slate-300 bg-slate-100 rounded text-slate-500">파일 ID 미등록</span> : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      </MemberSectionCard>

      <MemberSectionCard data-help-id="member-edit-company-ref" icon="business_center" iconClassName="text-[var(--kr-gov-green)]" title="회원사 정보">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="md:col-span-2">
            <label className="block text-[14px] font-bold text-[var(--kr-gov-text-primary)] mb-2">기관명</label>
            <AdminInput className="h-11 bg-gray-50 text-gray-600" readOnly type="text" value={String((page?.member as Record<string, unknown> | undefined)?.cmpnyNm || "-")} />
          </div>
          <div>
            <label className="block text-[14px] font-bold text-[var(--kr-gov-text-primary)] mb-2">대표자명</label>
            <AdminInput className="h-11 bg-gray-50 text-gray-600" readOnly type="text" value={String((page?.member as Record<string, unknown> | undefined)?.cxfc || "-")} />
          </div>
          <div>
            <label className="block text-[14px] font-bold text-[var(--kr-gov-text-primary)] mb-2">사업자등록번호</label>
            <AdminInput className="h-11 bg-gray-50 text-gray-600" readOnly type="text" value={String((page?.member as Record<string, unknown> | undefined)?.bizrno || "-")} />
          </div>
          <MemberInsetNotice className="md:col-span-2">{text(page, "이 영역은 회원사 기준 참조 정보입니다. 수정은 기관 관리 또는 승인 화면에서 진행해 주세요.", "This area is company reference data only. Edit it from company management or approval screens.")}</MemberInsetNotice>
        </div>
      </MemberSectionCard>
    </div>
  );
}
