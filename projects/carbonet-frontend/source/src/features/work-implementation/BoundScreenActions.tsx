import { useState } from "react";
import { fetchNewPagePage, fetchScreenBuilderPreview } from "../../lib/api/platform";
import { buildScreenBuilderPath, buildScreenRuntimePath } from "../screen-builder/screenBuilderPaths";
import { canonicalScreenPath, isPublishedScreenFor } from "../screen-builder/shared/publishedScreen";

export function BoundScreenActions({ routePath, screenName }: { routePath: string; screenName: string }) {
  const [target, setTarget] = useState<{ menuCode: string; pageId: string; menuUrl: string; menuTitle: string }>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [version, setVersion] = useState("");
  const valid = routePath.startsWith("/") && !routePath.startsWith("//") && !routePath.includes("\\");

  async function resolve() {
    if (loading) return;
    setLoading(true); setError(""); setTarget(undefined); setVersion("");
    try {
      const page = await fetchNewPagePage(routePath);
      if (!page.menuCode || !page.pageId || canonicalScreenPath(page.canonicalMenuUrl || "") !== canonicalScreenPath(routePath)) {
        throw new Error("이 화면의 메뉴·페이지 연결을 찾지 못했습니다. 화면 연결을 먼저 등록해 주세요.");
      }
      const resolved = { menuCode: page.menuCode, pageId: page.pageId, menuUrl: page.canonicalMenuUrl!, menuTitle: page.menuName || screenName };
      setTarget(resolved);
      const published = await fetchScreenBuilderPreview({ ...resolved, versionStatus: "PUBLISHED" });
      setVersion(isPublishedScreenFor(published, resolved) ? published.artifactEvidence?.publishedVersionId || published.releaseUnitId || "버전 미제공" : "게시본 없음 또는 연결 불일치");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "화면 연결 조회에 실패했습니다.");
    } finally { setLoading(false); }
  }

  if (!valid) return <span className="text-xs text-amber-800">MISSING_BINDING</span>;
  return <div className="space-y-2">
    <a className="break-all font-mono text-xs text-blue-700 underline" href={routePath}>{routePath}</a>
    <div className="flex flex-wrap gap-2">
      <button type="button" disabled={loading} className="rounded border border-slate-300 px-2 py-1 text-xs font-bold disabled:opacity-50" onClick={() => void resolve()}>{loading ? "화면 연결 확인 중…" : target ? "연결 다시 확인" : "화면 편집 연결"}</button>
      {target && <>
        <a className="rounded bg-blue-700 px-2 py-1 text-xs font-bold text-white" href={buildScreenBuilderPath(target)}>연결된 설계 편집</a>
        <a className="rounded border px-2 py-1 text-xs font-bold text-blue-700" href={buildScreenRuntimePath(target)}>게시본 확인</a>
      </>}
    </div>
    {target && <p className="text-xs text-slate-600">메뉴 {target.menuCode} · 페이지 {target.pageId}</p>}
    {version && <p className="text-xs text-slate-600">게시 버전: {version}</p>}
    {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
  </div>;
}
