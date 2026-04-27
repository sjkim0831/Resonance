import type { ScreenBuilderAutoReplacePreviewItem } from "../../../../lib/api/platformTypes";
import { GridToolbar } from "../../../admin-ui/common";

type Props = {
  autoReplacePreviewItems: ScreenBuilderAutoReplacePreviewItem[];
  en: boolean;
};

export default function GovernanceAutoReplacePreviewSection({ autoReplacePreviewItems, en }: Props) {
  return (
    <section className="gov-card p-0 overflow-hidden">
      <GridToolbar
        meta={en ? `${autoReplacePreviewItems.length} replacement candidates` : `대체 후보 ${autoReplacePreviewItems.length}건`}
        title={en ? "Auto Replace Diff Preview" : "자동 대체 Diff 미리보기"}
      />
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left border-collapse">
          <thead>
            <tr className="gov-table-header">
              <th className="px-4 py-3">nodeId</th>
              <th className="px-4 py-3">{en ? "Label" : "라벨"}</th>
              <th className="px-4 py-3">{en ? "From" : "기존"}</th>
              <th className="px-4 py-3">{en ? "To" : "대체"}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {autoReplacePreviewItems.length ? autoReplacePreviewItems.map((item) => (
              <tr key={`replace-preview-${item.nodeId}`}>
                <td className="px-4 py-3 font-mono text-[12px]">{item.nodeId}</td>
                <td className="px-4 py-3">{item.label}</td>
                <td className="px-4 py-3 font-mono text-[12px] text-amber-800">{item.fromComponentId}</td>
                <td className="px-4 py-3 font-mono text-[12px] text-emerald-800">{item.toComponentId}</td>
              </tr>
            )) : (
              <tr>
                <td className="px-4 py-8 text-center text-[var(--kr-gov-text-secondary)]" colSpan={4}>
                  {en ? "Run preview diff to inspect deprecated replacements before applying them." : "deprecated 대체를 적용하기 전에 diff 미리보기를 실행하세요."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
