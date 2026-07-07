import type { FrameworkAuthorityOption, FrameworkAuthorityRoleContract, FrameworkAuthorityText } from "../../../../framework";
import { GridToolbar, MemberButton } from "../../../admin-ui/common";

type Props = {
  authorityLoading: boolean;
  authorityAssignmentAuthorities: FrameworkAuthorityText[];
  authorityRoleCategories: FrameworkAuthorityText[];
  authorityRoleCategoryOptions: FrameworkAuthorityOption[];
  authorityRoleTemplates: FrameworkAuthorityRoleContract[];
  draftAuthorityAuthorCode: string;
  applyAuthorityRoleToDraft: (role: FrameworkAuthorityRoleContract) => void;
  en: boolean;
};

export default function GovernanceAuthoritySection({
  authorityLoading,
  authorityAssignmentAuthorities,
  authorityRoleCategories,
  authorityRoleCategoryOptions,
  authorityRoleTemplates,
  draftAuthorityAuthorCode,
  applyAuthorityRoleToDraft,
  en
}: Props) {
  return (
    <>
      <section className="gov-card p-0 overflow-hidden">
        <GridToolbar
          meta={authorityLoading
            ? (en ? "Loading framework authority templates..." : "프레임워크 권한 템플릿을 불러오는 중입니다.")
            : (en ? `${authorityRoleTemplates.length} builder-ready role templates from the framework authority contract.` : `프레임워크 권한 계약 기준 빌더 사용 가능 role template ${authorityRoleTemplates.length}건입니다.`)}
          title={en ? "Authority Role Templates" : "권한 Role 템플릿"}
        />
        <div className="grid grid-cols-1 gap-4 p-6 xl:grid-cols-2">
          {authorityRoleTemplates.map((role) => (
            <article className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white p-4" key={role.authorCode}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-[11px] text-[var(--kr-gov-text-secondary)]">{role.authorCode}</p>
                  <p className="mt-1 text-sm font-black text-[var(--kr-gov-text-primary)]">{role.label}</p>
                  <p className="mt-1 text-[12px] text-[var(--kr-gov-text-secondary)]">{role.description || "-"}</p>
                </div>
                <div className="flex flex-wrap justify-end gap-1 text-[10px] font-bold">
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700">{role.tier}</span>
                  <span className="rounded-full bg-blue-50 px-2 py-1 text-blue-700">{role.scopePolicy}</span>
                  <span className="rounded-full bg-emerald-50 px-2 py-1 text-emerald-700">{role.actorType}</span>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                <span className="rounded-full bg-indigo-50 px-2 py-1 font-mono text-indigo-800">
                  {en ? `level ${role.hierarchyLevel}` : `레벨 ${role.hierarchyLevel}`}
                </span>
                <span className="rounded-full bg-slate-100 px-2 py-1 font-mono text-slate-700">
                  {en ? `${role.featureCodes.length} feature grants` : `기능 권한 ${role.featureCodes.length}개`}
                </span>
                {role.inherits.map((item) => (
                  <span className="rounded-full bg-amber-50 px-2 py-1 font-mono text-amber-800" key={`${role.authorCode}-${item}`}>
                    inherits: {item}
                  </span>
                ))}
              </div>
              <div className="mt-3 rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-[var(--kr-gov-bg-muted)] px-3 py-3">
                <p className="font-mono text-[11px] text-[var(--kr-gov-text-secondary)]">
                  {(role.featureCodes || []).slice(0, 8).join(", ") || (en ? "No explicit feature grants" : "명시된 기능 권한 없음")}
                </p>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <MemberButton onClick={() => applyAuthorityRoleToDraft(role)} size="xs" type="button" variant={draftAuthorityAuthorCode === role.authorCode ? "primary" : "secondary"}>
                  {draftAuthorityAuthorCode === role.authorCode ? (en ? "Applied to draft" : "Draft 반영됨") : (en ? "Use in draft" : "Draft에 반영")}
                </MemberButton>
                <MemberButton onClick={() => { void navigator.clipboard.writeText(role.authorCode); }} size="xs" type="button" variant="secondary">
                  {en ? "Copy authorCode" : "authorCode 복사"}
                </MemberButton>
                <MemberButton onClick={() => { void navigator.clipboard.writeText((role.featureCodes || []).join("\n")); }} size="xs" type="button" variant="secondary">
                  {en ? "Copy feature codes" : "기능 코드 복사"}
                </MemberButton>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="gov-card p-0 overflow-hidden">
        <GridToolbar
          meta={en
            ? "The governance guide below is loaded from the framework authority contract, not hardcoded screen text."
            : "아래 거버넌스 가이드는 화면 하드코딩이 아니라 framework authority contract에서 직접 읽어옵니다."}
          title={en ? "Authority Contract Guides" : "권한 계약 가이드"}
        />
        <div className="grid grid-cols-1 gap-4 p-6 xl:grid-cols-3">
          <article className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white p-4">
            <p className="text-sm font-black text-[var(--kr-gov-text-primary)]">{en ? "Role Category Options" : "Role Category 옵션"}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {authorityRoleCategoryOptions.map((item) => (
                <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-700" key={item.code}>
                  {item.code} · {item.name}
                </span>
              ))}
            </div>
          </article>
          <article className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white p-4">
            <p className="text-sm font-black text-[var(--kr-gov-text-primary)]">{en ? "Assignment Authorities" : "권한 할당 가이드"}</p>
            <div className="mt-3 space-y-3">
              {authorityAssignmentAuthorities.map((item) => (
                <div className="rounded border border-[var(--kr-gov-border-light)] bg-[var(--kr-gov-bg-muted)] px-3 py-3" key={item.title}>
                  <p className="text-xs font-black text-[var(--kr-gov-text-primary)]">{item.title}</p>
                  <p className="mt-1 text-[12px] text-[var(--kr-gov-text-secondary)]">{item.description}</p>
                </div>
              ))}
            </div>
          </article>
          <article className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white p-4">
            <p className="text-sm font-black text-[var(--kr-gov-text-primary)]">{en ? "Role Category Guides" : "권한 카테고리 가이드"}</p>
            <div className="mt-3 space-y-3">
              {authorityRoleCategories.map((item) => (
                <div className="rounded border border-[var(--kr-gov-border-light)] bg-[var(--kr-gov-bg-muted)] px-3 py-3" key={item.title}>
                  <p className="text-xs font-black text-[var(--kr-gov-text-primary)]">{item.title}</p>
                  <p className="mt-1 text-[12px] text-[var(--kr-gov-text-secondary)]">{item.description}</p>
                </div>
              ))}
            </div>
          </article>
        </div>
      </section>
    </>
  );
}
