import type { AiNodeTreeInputRow } from "../../shared/screenBuilderShared";
import { GridToolbar, MemberButton } from "../../../admin-ui/common";

type Props = {
  addAiNodeTreeRow: () => void;
  aiNodeTreeRows: AiNodeTreeInputRow[];
  en: boolean;
  handleAddNodeTreeFromAiSurface: () => Promise<void>;
  removeAiNodeTreeRow: (index: number) => void;
  saving: boolean;
  updateAiNodeTreeRow: (index: number, field: keyof AiNodeTreeInputRow, value: string) => void;
};

export default function GovernanceAiNodeTreeSection({
  addAiNodeTreeRow,
  aiNodeTreeRows,
  en,
  handleAddNodeTreeFromAiSurface,
  removeAiNodeTreeRow,
  saving,
  updateAiNodeTreeRow
}: Props) {
  return (
    <section className="gov-card p-0 overflow-hidden">
      <GridToolbar
        actions={(
          <MemberButton disabled={saving} onClick={() => { void handleAddNodeTreeFromAiSurface(); }} size="sm" type="button" variant="secondary">
            {en ? "Add node tree" : "노드 트리 추가"}
          </MemberButton>
        )}
        meta={en ? "Use componentId, alias, parentAlias, and props to append a node tree in one request." : "componentId, alias, parentAlias, props로 한 번에 노드 트리를 추가합니다."}
        title={en ? "AI Node Tree Input" : "AI 노드 트리 입력"}
      />
      <div className="space-y-4 p-6">
        {aiNodeTreeRows.map((row, index) => (
          <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white p-4" key={`ai-row-${index}`}>
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
              <label className="block">
                <span className="gov-label">componentId</span>
                <input className="gov-input font-mono" value={row.componentId} onChange={(event) => updateAiNodeTreeRow(index, "componentId", event.target.value)} />
              </label>
              <label className="block">
                <span className="gov-label">alias</span>
                <input className="gov-input" value={row.alias} onChange={(event) => updateAiNodeTreeRow(index, "alias", event.target.value)} />
              </label>
              <label className="block">
                <span className="gov-label">{en ? "parentAlias" : "상위 alias"}</span>
                <input className="gov-input" value={row.parentAlias} onChange={(event) => updateAiNodeTreeRow(index, "parentAlias", event.target.value)} />
              </label>
              <div className="flex items-end">
                <MemberButton disabled={aiNodeTreeRows.length <= 1} onClick={() => removeAiNodeTreeRow(index)} size="xs" type="button" variant="dangerSecondary">
                  {en ? "Remove" : "제거"}
                </MemberButton>
              </div>
            </div>
            <label className="mt-4 block">
              <span className="gov-label">props JSON</span>
              <textarea
                className="gov-input min-h-[120px] py-3 font-mono text-[12px]"
                rows={5}
                value={row.propsJson}
                onChange={(event) => updateAiNodeTreeRow(index, "propsJson", event.target.value)}
              />
            </label>
          </div>
        ))}
        <div className="flex justify-start">
          <MemberButton onClick={addAiNodeTreeRow} size="xs" type="button" variant="secondary">
            {en ? "Add Row" : "행 추가"}
          </MemberButton>
        </div>
        <div className="rounded-[var(--kr-gov-radius)] border border-slate-200 bg-slate-50 px-4 py-4">
          <p className="text-xs font-black uppercase tracking-[0.08em] text-[var(--kr-gov-text-secondary)]">{en ? "Generated Request Preview" : "생성 요청 미리보기"}</p>
          <pre className="mt-3 overflow-x-auto rounded bg-slate-950 px-3 py-3 text-[11px] leading-5 text-slate-100">{JSON.stringify(
            aiNodeTreeRows.map((row) => ({
              componentId: row.componentId.trim(),
              alias: row.alias.trim() || undefined,
              parentAlias: row.parentAlias.trim() || undefined,
              props: row.propsJson.trim()
            })),
            null,
            2
          )}</pre>
        </div>
      </div>
    </section>
  );
}
