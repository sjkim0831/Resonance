import { useEffect, useMemo, useState } from "react";
import type { HomeMenuItem } from "../../features/home-entry/homeEntryTypes";
import { buildLocalizedPath, isEnglish } from "../../lib/navigation/runtime";

type WorkLink = { label: string; labelEn: string; href: string; hrefEn: string };
type WorkGroup = { label: string; labelEn: string; links: WorkLink[] };

const GROUPS: WorkGroup[] = [
  { label: "현황·프로젝트", labelEn: "Overview & projects", links: [
    { label: "배출량 현황", labelEn: "Emission dashboard", href: "/emission/index", hrefEn: "/en/emission/index" },
    { label: "배출량 프로젝트", labelEn: "Emission projects", href: "/emission/project_list", hrefEn: "/en/emission/project_list" },
    { label: "담당 업무", labelEn: "Assigned work", href: "/emission/my-tasks", hrefEn: "/en/emission/my-tasks" },
    { label: "마감·지연 현황", labelEn: "Deadlines & delays", href: "/emission/deadline-status", hrefEn: "/en/emission/deadline-status" },
  ] },
  { label: "활동자료 관리", labelEn: "Activity data", links: [
    { label: "자료 제출 요청", labelEn: "Data requests", href: "/emission/data-request", hrefEn: "/en/emission/data-request" },
    { label: "활동자료 관리", labelEn: "Activity data", href: "/emission/activity-data", hrefEn: "/en/emission/activity-data" },
    { label: "증빙 자료함", labelEn: "Evidence library", href: "/emission/evidence", hrefEn: "/en/emission/evidence" },
  ] },
  { label: "산정·검증", labelEn: "Calculation & verification", links: [
    { label: "배출원·시설 관리", labelEn: "Sources & facilities", href: "/home/emission/source-register", hrefEn: "/en/home/emission/source-register" },
    { label: "산정 기준·배출계수", labelEn: "Factors & methodology", href: "/home/emission/factor-reference", hrefEn: "/en/home/emission/factor-reference" },
    { label: "배출량 산정", labelEn: "Emission calculation", href: "/emission/calculation", hrefEn: "/en/emission/calculation" },
    { label: "산정 결과", labelEn: "Calculation results", href: "/emission/calculation-results", hrefEn: "/en/emission/calculation-results" },
    { label: "데이터 검증", labelEn: "Data validation", href: "/emission/data-validation", hrefEn: "/en/emission/data-validation" },
    { label: "검토·승인", labelEn: "Review & approval", href: "/emission/review-approval", hrefEn: "/en/emission/review-approval" },
    { label: "보완·재산정", labelEn: "Corrections & recalculation", href: "/emission/correction", hrefEn: "/en/emission/correction" },
  ] },
  { label: "확정·보고", labelEn: "Finalization & reporting", links: [
    { label: "배출량 확정", labelEn: "Finalize emissions", href: "/emission/finalization", hrefEn: "/en/emission/finalization" },
    { label: "보고서 작성·제출", labelEn: "Reports & submission", href: "/emission/report-write", hrefEn: "/en/emission/report-write" },
    { label: "규제기관 제출·접수", labelEn: "Regulator submission & receipt", href: "/emission/report-submission", hrefEn: "/en/emission/report-submission" },
    { label: "보고서·인증서 발급", labelEn: "Reports & certificates", href: "/emission/report-download", hrefEn: "/en/emission/report-download" },
  ] },
  { label: "기준 및 관리", labelEn: "Standards & management", links: [
    { label: "조직 경계·사업장", labelEn: "Organization & sites", href: "/emission/org-boundary", hrefEn: "/en/emission/org-boundary" },
    { label: "외부 데이터 연계", labelEn: "External data integration", href: "/emission/external-data", hrefEn: "/en/emission/external-data" },
  ] },
];

function normalizedPath(value: string) {
  try { return new URL(value, window.location.origin).pathname.replace(/^\/en(?=\/)/, "").replace(/\/$/, "") || "/"; }
  catch { return ""; }
}
export function EmissionWorkSidebar({ homeMenu, currentPath }: { homeMenu: HomeMenuItem[]; currentPath: string }) {
  const en = isEnglish();
  const [mobileOpen, setMobileOpen] = useState(false);
  const authorized = useMemo(() => {
    const paths = new Set<string>();
    for (const top of homeMenu) {
      if (top.url) paths.add(normalizedPath(top.url));
      for (const section of top.sections || []) for (const item of section.items || []) if (item.url) paths.add(normalizedPath(item.url));
    }
    return paths;
  }, [homeMenu]);
  const groups = useMemo(() => GROUPS.map(group => ({ ...group, links: group.links.filter(link => authorized.has(normalizedPath(link.href))) })).filter(group => group.links.length), [authorized]);
  const currentGroup = useMemo(() => groups.find(group => group.links.some(link => normalizedPath(currentPath) === normalizedPath(link.href))), [groups, currentPath]);
  const [openGroups, setOpenGroups] = useState<string[]>([]);
  const visibleGroups = groups;

  const toggleGroup = (groupLabel: string) => setOpenGroups(current => current.includes(groupLabel)
    ? current.filter(label => label !== groupLabel)
    : [...current, groupLabel]);

  useEffect(() => {
    document.body.classList.toggle("ew-mobile-nav-open", mobileOpen);
    return () => document.body.classList.remove("ew-mobile-nav-open");
  }, [mobileOpen]);
  if (!groups.length) return null;
  const label = (link: WorkLink) => en ? link.labelEn : link.label;
  const closeOnMobile = () => setMobileOpen(false);

  return <>
    <button type="button" className="ew-mobile-trigger" aria-expanded={mobileOpen} aria-controls="emission-work-nav" onClick={() => setMobileOpen(true)}>
      <span aria-hidden="true">☰</span>{en ? "Work menu" : "업무 메뉴"}
    </button>
    {mobileOpen && <button type="button" className="ew-mobile-scrim" aria-label={en ? "Close work menu" : "업무 메뉴 닫기"} onClick={closeOnMobile} />}
    <aside id="emission-work-nav" aria-label={en ? "Emission work navigation" : "탄소배출 업무 메뉴"}
      className={`ew-sidebar ${mobileOpen ? "ew-sidebar-mobile-open" : ""}`}>
      <div className="ew-sidebar-top">
        <div><h2>{en ? "Emission management" : "탄소배출 관리"}</h2></div>
        <button type="button" className="ew-mobile-close" aria-label={en ? "Close" : "닫기"} onClick={closeOnMobile}>×</button>
      </div>
      <nav className="ew-sidebar-nav">
          {visibleGroups.map((group, index) => {
            const expanded = openGroups.includes(group.label);
            const isCurrentGroup = currentGroup?.label === group.label;
            const panelId = `ew-group-${index}`;
            return <section key={group.label} className={`ew-sidebar-group ${isCurrentGroup ? "ew-sidebar-group-current" : ""}`}>
            <h3><button type="button" className="ew-group-toggle" aria-expanded={expanded} aria-controls={panelId} onClick={() => toggleGroup(group.label)}>
              <span>{en ? group.labelEn : group.label}</span><span className="ew-group-chevron" aria-hidden="true">{expanded ? "⌃" : "⌄"}</span>
            </button></h3>
            {expanded && <ul id={panelId}>{group.links.map(link => {
              const active = normalizedPath(currentPath) === normalizedPath(link.href);
              return <li key={link.href}><a href={buildLocalizedPath(link.href, link.hrefEn)} onClick={closeOnMobile} aria-current={active ? "page" : undefined} className={active ? "ew-sidebar-link ew-sidebar-link-active" : "ew-sidebar-link"}>
                <span className="ew-link-marker" aria-hidden="true">{active ? "●" : "›"}</span><span>{label(link)}</span>{active && <span className="ew-current-tag">{en ? "CURRENT" : "현재"}</span>}
              </a></li>;
            })}</ul>}
          </section>})}
          {visibleGroups.length === 0 && <p className="ew-sidebar-no-results">{en ? "No available menu for this page." : "이 화면에 연결된 이용 가능 메뉴가 없습니다."}</p>}
      </nav>
    </aside>
  </>;
}

export const emissionWorkSidebarStyles = `
.emission-list-v1 .el-main{box-sizing:border-box;width:100%;max-width:1280px!important;margin-inline:auto;padding:32px 32px 64px}
.emission-list-v1 .ew-work-layout.el-work-layout{position:static;left:auto;transform:none;display:grid;grid-template-columns:224px minmax(0,1fr);align-items:start;gap:28px;width:100%;max-width:none;margin:0;padding:0 0 46px;box-sizing:border-box}
.ew-sidebar{position:sticky;top:20px;max-height:calc(100vh - 40px);overflow:auto;border:1px solid #c6d5e5;border-radius:11px;background:#fff;color:#183452;box-shadow:0 8px 22px rgba(15,43,74,.08)}
.ew-sidebar-top{position:sticky;top:0;z-index:1;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:18px 16px 15px;border-bottom:1px solid #dce5ef;background:linear-gradient(145deg,#06376b 0%,#0755a1 100%);color:white}
.ew-sidebar-eyebrow{color:#c7def7;font-size:10px;font-weight:800;letter-spacing:.12em}.ew-sidebar-top h2{margin:5px 0 0;font-size:18px;font-weight:800;color:#fff}.ew-sidebar-top p{margin:2px 0 0;color:#dcecff;font-size:12px}
.ew-mobile-close{display:none!important;width:30px;height:30px;place-items:center;border:1px solid rgba(255,255,255,.4);border-radius:6px;background:rgba(255,255,255,.12);color:#fff;font-size:20px;line-height:1;cursor:pointer}
.ew-sidebar-nav{padding:0 12px 12px}.ew-sidebar-group{padding:0;border-bottom:1px solid #e5ebf2}.ew-sidebar-group:last-child{border-bottom:0}.ew-sidebar-group h3{margin:0;color:#173d67;font-size:12px;font-weight:800}.ew-group-toggle{display:flex;width:100%;min-height:48px;align-items:center;justify-content:space-between;gap:8px;padding:10px 5px;border:0;background:transparent;color:inherit;text-align:left;font:inherit;cursor:pointer}.ew-group-toggle:hover{color:#0756a5;background:#f5f8fc}.ew-group-toggle:focus-visible{outline:3px solid #f0b323;outline-offset:-3px}.ew-group-chevron{color:#7188a2;font-size:16px}.ew-sidebar-group-current .ew-group-toggle{color:#0756a5}.ew-sidebar-group ul{margin:0;padding:0 0 9px;list-style:none}.ew-sidebar-link{display:flex;min-height:36px;align-items:center;gap:8px;margin:2px 0;padding:7px 8px;border-radius:5px;color:#425a74;text-decoration:none;font-size:13px;line-height:1.35}.ew-sidebar-link:hover{background:#edf4fc;color:#064a91}.ew-sidebar-link-active{background:#082f5b;color:#fff;font-weight:800;box-shadow:inset 3px 0 #f0b323}.ew-sidebar-link-active:hover{background:#082f5b;color:#fff}.ew-link-marker{width:13px;color:#54799f;font-size:15px;font-weight:900}.ew-sidebar-link-active .ew-link-marker{color:#ffd76a;font-size:9px}.ew-current-tag{margin-left:auto;font-size:9px;letter-spacing:.03em;opacity:.82}.ew-sidebar-no-results{margin:8px 4px;padding:12px;border-radius:5px;background:#f5f8fc;color:#536a83;font-size:12px}.ew-sidebar-footnote{margin:0;padding:11px 14px;border-top:1px solid #dce5ef;background:#f5f8fc;color:#64768a;font-size:10px;line-height:1.4}
.ew-mobile-trigger{display:none!important;position:relative;z-index:1350}.ew-mobile-scrim{display:none}
@media(max-width:1100px){.ew-sidebar-group h3{font-size:11px}.ew-sidebar-link{font-size:12px}}
@media(max-width:1023px){.emission-list-v1 .ew-work-layout.el-work-layout{width:100%}}
@media(max-width:1023px){.emission-list-v1 .el-main{padding-left:16px;padding-right:16px}}
@media(max-width:1023px){.emission-list-v1 .ew-work-layout.el-work-layout{position:static;left:auto;transform:none;display:block;width:100%;margin:0}.ew-mobile-trigger{display:inline-flex!important;align-items:center;gap:8px;margin:0 0 14px;padding:9px 13px;border:1px solid #9bb4cf;border-radius:6px;background:white;color:#073e78;font-size:13px;font-weight:800;cursor:pointer}.ew-sidebar{display:none}.ew-sidebar.ew-sidebar-mobile-open{position:fixed;inset:0 auto 0 0;z-index:1410;display:block;width:min(320px,calc(100vw - 48px));max-height:100dvh;border-radius:0 12px 12px 0}.ew-mobile-scrim{position:fixed;inset:0;z-index:1400;display:block;border:0;background:rgba(5,25,48,.48)}.ew-sidebar-mobile-open .ew-sidebar-top{padding-right:12px}.ew-sidebar-mobile-open .ew-mobile-close{display:inline-grid!important}.ew-sidebar-mobile-open .ew-sidebar-nav{display:block}.ew-sidebar-footnote{display:block}}
@media(max-width:560px){.ew-sidebar.ew-sidebar-mobile-open{width:min(320px,calc(100vw - 40px))}.ew-sidebar-nav{grid-template-columns:1fr}.ew-sidebar-group ul{display:block}.ew-sidebar-link{font-size:13px;padding:8px}.ew-sidebar-group h3{font-size:12px}}
`;
