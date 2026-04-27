import type { ScreenBuilderComponentPromptSurface } from "../../../../lib/api/platformTypes";
import { GridToolbar, MemberButton } from "../../../admin-ui/common";

type Props = {
  componentPromptSurface: ScreenBuilderComponentPromptSurface[];
  en: boolean;
  handleAddNodeFromComponent: (componentId: string) => Promise<void>;
  saving: boolean;
};

export default function GovernanceAiPromptSurfaceSection({
  componentPromptSurface,
  en,
  handleAddNodeFromComponent,
  saving
}: Props) {
  return (
    <section className="gov-card p-0 overflow-hidden">
      <GridToolbar
        meta={en ? `${componentPromptSurface.length} prompt-ready contracts` : `AI 입력 계약 ${componentPromptSurface.length}건`}
        title={en ? "AI Component Prompt Surface" : "AI 컴포넌트 입력 표면"}
      />
      <div className="grid grid-cols-1 gap-4 p-6 xl:grid-cols-2">
        {componentPromptSurface.map((item) => (
          <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white p-4" key={`prompt-${item.componentId}`}>
            <div className="flex items-center justify-between gap-3">
              <p className="font-mono text-xs text-[var(--kr-gov-text-secondary)]">{item.componentId}</p>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${item.status === "DEPRECATED" ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-700"}`}>
                {item.status || "ACTIVE"}
              </span>
            </div>
            <p className="mt-2 text-sm font-bold text-[var(--kr-gov-text-primary)]">{item.label}</p>
            {item.description ? <p className="mt-1 text-[12px] text-[var(--kr-gov-text-secondary)]">{item.description}</p> : null}
            <p className="mt-3 text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--kr-gov-text-secondary)]">{en ? "Allowed Props" : "허용 Props"}</p>
            <p className="mt-1 text-[12px] text-[var(--kr-gov-text-primary)]">{item.allowedPropKeys.join(", ") || "-"}</p>
            <div className="mt-3">
              <MemberButton disabled={saving || item.status === "DEPRECATED"} onClick={() => { void handleAddNodeFromComponent(item.componentId); }} size="xs" type="button" variant="secondary">
                {en ? "Add node from componentId" : "componentId로 노드 추가"}
              </MemberButton>
            </div>
            <pre className="mt-3 overflow-x-auto rounded bg-slate-950 px-3 py-3 text-[11px] leading-5 text-slate-100">{JSON.stringify({
              componentId: item.componentId,
              componentType: item.componentType,
              propsTemplate: item.propsTemplate
            }, null, 2)}</pre>
          </div>
        ))}
      </div>
    </section>
  );
}
