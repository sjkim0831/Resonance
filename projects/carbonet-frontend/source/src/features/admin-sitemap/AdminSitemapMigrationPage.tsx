import { useEffect } from "react";
import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { logGovernanceScope } from "../../app/policy/debug";
import { fetchAdminSitemapPage } from "../../lib/api/content";
import type { SitemapNode, SitemapPagePayload } from "../../lib/api/appBootstrapTypes";
import { AdminPageShell } from "../admin-entry/AdminPageShell";
import { buildLocalizedPath, isEnglish } from "../../lib/navigation/runtime";
import { CollectionResultPanel, GridToolbar, PageStatusNotice, SummaryMetricCard } from "../admin-ui/common";
import { AdminWorkspacePageFrame } from "../admin-ui/pageFrames";

function stringOf(value: unknown) {
  return typeof value === "string" ? value : "";
}

function iconOf(value: unknown, fallback: string) {
  const next = stringOf(value);
  return next || fallback;
}

export function AdminSitemapMigrationPage() {
  const en = isEnglish();
  const pageState = useAsyncValue<SitemapPagePayload>(() => fetchAdminSitemapPage(), [en]);
  const sections = (pageState.value?.siteMapSections || []) as SitemapNode[];
  const sectionCount = sections.length;
  const categoryCount = sections.reduce((total, top) => total + (top.children || []).length, 0);
  const itemCount = sections.reduce((total, top) => (
    total + (top.children || []).reduce((childTotal, section) => childTotal + (section.children || []).length, 0)
  ), 0);

  useEffect(() => {
    if (!pageState.value) {
      return;
    }
    logGovernanceScope("PAGE", "admin-sitemap", {
      route: window.location.pathname,
      sectionCount,
      itemCount
    });
    logGovernanceScope("COMPONENT", "admin-sitemap-tree", {
      component: "admin-sitemap-tree",
      sectionCount,
      itemCount
    });
  }, [pageState.value, sections]);

  return (
    <AdminPageShell
      breadcrumbs={[
        { label: en ? "Home" : "홈", href: buildLocalizedPath("/admin/", "/en/admin/") },
        { label: en ? "Content" : "콘텐츠" },
        { label: en ? "Sitemap" : "사이트맵" }
      ]}
      title={en ? "Admin Sitemap" : "관리자 사이트맵"}
      subtitle={en
        ? "This sitemap shows the administrator menus available to the current role."
        : "현재 권한으로 접근 가능한 관리자 메뉴를 실시간 트리로 보여줍니다."}
    >
      <AdminWorkspacePageFrame>
        <CollectionResultPanel
          className="rounded-2xl border-blue-200 bg-[linear-gradient(135deg,rgba(33,123,214,0.12),rgba(255,255,255,0.98))]"
          data-help-id="admin-sitemap-hero"
          description={en
            ? "This sitemap refreshes from the live admin menu tree, menu order, and view-permission mapping."
            : "메뉴 관리의 노출 상태, 순서, 페이지 연결이 바뀌면 이 화면도 같은 기준으로 즉시 갱신됩니다."}
          icon="account_tree"
          title={en ? "Admin Sitemap" : "관리자 사이트맵"}
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <SummaryMetricCard title={en ? "Top Sections" : "최상위 섹션"} value={sectionCount} />
            <SummaryMetricCard title={en ? "Categories" : "카테고리"} value={categoryCount} />
            <SummaryMetricCard title={en ? "Leaf Menus" : "하위 메뉴"} value={itemCount} />
          </div>
        </CollectionResultPanel>

        <CollectionResultPanel
          description={en
            ? "Use this screen to validate menu exposure after menu, authority, or route changes."
            : "메뉴, 권한, route 변경 후 실제 노출 구조를 검증할 때 사용합니다."}
          icon="info"
          title={en ? "Generation Rule" : "구성 기준"}
        >
          {en
            ? "The admin sitemap is generated from AMENU1, menu-order metadata, and the current administrator's view permissions."
            : "관리자 사이트맵은 AMENU1, 메뉴 정렬 정보, 현재 로그인한 관리자 권한의 VIEW 기능 매핑을 기준으로 구성됩니다."}
        </CollectionResultPanel>

        {pageState.error ? <PageStatusNotice tone="error">{pageState.error}</PageStatusNotice> : null}

        <section className="grid grid-cols-1 gap-6 xl:grid-cols-2" data-help-id="admin-sitemap-tree">
          {sections.map((top) => (
            <article className="gov-card overflow-hidden p-0" key={top.code || top.label}>
              <GridToolbar
                meta={stringOf(top.code)}
                title={<a className="inline-flex items-center gap-2 text-xl font-black text-[var(--kr-gov-blue)] hover:underline" href={stringOf(top.url) || "#"}>{stringOf(top.label)}</a>}
              />
              <div className="p-6 space-y-5">
                {(top.children || []).map((section) => (
                  <section key={section.code || section.label}>
                    <div className="mb-3 flex items-center gap-2">
                      <span className="material-symbols-outlined text-[var(--kr-gov-blue)]">{iconOf(section.icon, "folder_open")}</span>
                      <h3 className="text-lg font-bold">{stringOf(section.label)}</h3>
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                      {(section.children || []).map((item) => (
                        <a className="inline-flex items-center gap-2 rounded-[var(--kr-gov-radius)] border border-transparent px-3 py-2 text-sm font-medium text-[var(--kr-gov-text-primary)] transition-colors hover:border-[var(--kr-gov-border-light)] hover:bg-[var(--kr-gov-bg-gray)] hover:text-[var(--kr-gov-blue)]" href={stringOf(item.url) || "#"} key={item.code || item.label}>
                          <span className="material-symbols-outlined text-[20px] text-[var(--kr-gov-blue)]">{iconOf(item.icon, "chevron_right")}</span>
                          <span>{stringOf(item.label)}</span>
                        </a>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            </article>
          ))}
        </section>
      </AdminWorkspacePageFrame>
    </AdminPageShell>
  );
}
