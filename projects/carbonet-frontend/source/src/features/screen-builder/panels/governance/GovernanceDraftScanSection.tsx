import type { ScreenBuilderRegistryScanItem } from "../../../../lib/api/platformTypes";
import { GridToolbar } from "../../../admin-ui/common";

type Props = {
  en: boolean;
  registryScanRows: ScreenBuilderRegistryScanItem[];
};

export default function GovernanceDraftScanSection({ en, registryScanRows }: Props) {
  return (
    <section className="gov-card p-0 overflow-hidden">
      <GridToolbar
        meta={en ? `${registryScanRows.length} drafts scanned` : `스캔된 draft ${registryScanRows.length}건`}
        title={en ? "All Draft Registry Scan" : "전체 Draft 레지스트리 스캔"}
      />
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left border-collapse">
          <thead>
            <tr className="gov-table-header">
              <th className="px-4 py-3">menuCode</th>
              <th className="px-4 py-3">pageId</th>
              <th className="px-4 py-3">{en ? "Title" : "메뉴명"}</th>
              <th className="px-4 py-3">{en ? "Unregistered" : "미등록"}</th>
              <th className="px-4 py-3">{en ? "Missing" : "누락"}</th>
              <th className="px-4 py-3">{en ? "Deprecated" : "Deprecated"}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {registryScanRows.length ? registryScanRows.map((row) => (
              <tr key={`scan-${row.menuCode}-${row.pageId}`}>
                <td className="px-4 py-3 font-mono text-[12px]">{row.menuCode}</td>
                <td className="px-4 py-3">{row.pageId}</td>
                <td className="px-4 py-3">{row.menuTitle || "-"}</td>
                <td className="px-4 py-3">{row.unregisteredCount}</td>
                <td className="px-4 py-3">{row.missingCount}</td>
                <td className="px-4 py-3">{row.deprecatedCount}</td>
              </tr>
            )) : (
              <tr>
                <td className="px-4 py-8 text-center text-[var(--kr-gov-text-secondary)]" colSpan={6}>
                  {en ? "Run a scan to inspect all builder drafts." : "전체 빌더 draft를 점검하려면 스캔을 실행하세요."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
