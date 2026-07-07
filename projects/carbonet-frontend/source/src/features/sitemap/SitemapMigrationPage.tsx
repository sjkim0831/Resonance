import {
  UserGovernmentBar,
  UserLanguageToggle,
  UserPortalFooter,
  UserPortalHeader
} from "../../components/user-shell/UserPortalChrome";
import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { logGovernanceScope } from "../../app/policy/debug";
import { fetchSitemapPage } from "../../lib/api/appBootstrap";
import type { SitemapNode, SitemapPagePayload } from "../../lib/api/appBootstrapTypes";
import { buildLocalizedPath, isEnglish, navigate } from "../../lib/navigation/runtime";
import { useEffect } from "react";

function stringOf(value: unknown) {
  return typeof value === "string" ? value : "";
}

function iconOf(value: unknown, fallback: string) {
  const next = stringOf(value);
  return next || fallback;
}

export function SitemapMigrationPage() {
  const en = isEnglish();
  const pageState = useAsyncValue<SitemapPagePayload>(
    () => fetchSitemapPage(),
    [en]
  );
  const page = pageState.value;
  const sections = (page?.siteMapSections || []) as SitemapNode[];

  useEffect(() => {
    logGovernanceScope("PAGE", "sitemap", {
      language: en ? "en" : "ko",
      sectionCount: sections.length,
      error: pageState.error || ""
    });
    logGovernanceScope("COMPONENT", "sitemap-tree", {
      sectionCount: sections.length,
      topLabels: sections.slice(0, 5).map((item) => item.label || item.code || "")
    });
  }, [en, pageState.error, sections]);

  return (
    <div className="bg-[var(--kr-gov-bg-gray)] text-[var(--kr-gov-text-primary)] min-h-screen flex flex-col">
      <UserGovernmentBar
        governmentText={en ? "Official Website of the Republic of Korea Government" : "대한민국 정부 공식 서비스"}
        guidelineText={en ? "This website complies with the 2025 Digital Government UI/UX Guidelines." : "이 누리집은 2025 디지털 정부 UI/UX 가이드라인을 준수합니다."}
      />
      <UserPortalHeader
        brandTitle={en ? "CCUS Footprint Platform" : "CCUS 탄소발자국 플랫폼"}
        brandSubtitle="Carbon Footprint Platform"
        homeHref={buildLocalizedPath("/home", "/en/home")}
        rightContent={(
          <UserLanguageToggle
            en={en}
            onKo={() => navigate("/sitemap")}
            onEn={() => navigate("/en/sitemap")}
          />
        )}
      />
      <main className="max-w-7xl mx-auto w-full px-4 lg:px-8 py-12 flex-1" id="main-content">
        <section className="rounded-2xl bg-gradient-to-r from-[var(--kr-gov-blue)] to-[#0b5fb8] text-white px-8 py-10 shadow-lg" data-help-id="sitemap-hero">
          <p className="text-sm font-bold tracking-[0.2em] uppercase opacity-80">Site Navigation</p>
          <h2 className="text-4xl font-black mt-3">{en ? "Sitemap" : "사이트맵"}</h2>
          <p className="text-base text-blue-50 mt-4 max-w-3xl leading-relaxed">
            {en
              ? "This is the full user menu structure generated from the home menu hierarchy and sort order."
              : "홈 메뉴 관리 기준으로 자동 구성되는 전체 사용자 메뉴 구조입니다. 메뉴 관리에서 순서나 노출 상태가 바뀌면 이 화면도 같은 트리 기준으로 즉시 반영됩니다."}
          </p>
        </section>

        <section className="mt-8 rounded-[var(--kr-gov-radius)] border border-blue-100 bg-blue-50 px-5 py-4 text-sm text-[var(--kr-gov-text-secondary)]">
          {en
            ? "The sitemap is rendered from the HMENU1 tree and menu ordering data."
            : "현재 사이트맵은 HMENU1 메뉴 트리와 메뉴 정렬 정보를 기준으로 렌더링됩니다."}
        </section>

        {pageState.error ? (
          <div className="mt-6 rounded-[var(--kr-gov-radius)] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {pageState.error}
          </div>
        ) : null}

        <section className="mt-10 grid grid-cols-1 xl:grid-cols-2 gap-6" data-help-id="sitemap-tree">
          {sections.map((top) => (
            <article className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white shadow-sm" key={top.code || top.label}>
              <div className="border-b border-[var(--kr-gov-border-light)] px-6 py-5">
                <a className="inline-flex items-center gap-2 text-2xl font-black text-[var(--kr-gov-blue)] hover:underline" href={stringOf(top.url) || "#"}>
                  {stringOf(top.label)}
                </a>
                <p className="text-sm text-[var(--kr-gov-text-secondary)] mt-2">{stringOf(top.code)}</p>
              </div>
              <div className="p-6 space-y-5">
                {(top.children || []).map((section) => (
                  <section key={section.code || section.label}>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="material-symbols-outlined text-[var(--kr-gov-blue)]">{iconOf(section.icon, "folder_open")}</span>
                      <h3 className="text-lg font-bold">{stringOf(section.label)}</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {(section.children || []).map((item) => (
                        <a className="inline-flex items-center gap-2 rounded-[var(--kr-gov-radius)] px-3 py-2 text-sm font-medium text-[var(--kr-gov-text-primary)] hover:bg-[var(--kr-gov-bg-gray)] hover:text-[var(--kr-gov-blue)] transition-colors" href={stringOf(item.url) || "#"} key={item.code || item.label}>
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
      </main>
      <UserPortalFooter
        orgName={en ? "CCUS Integrated Management HQ" : "CCUS 통합관리본부"}
        addressLine={en ? "(04551) 110 Sejong-daero, Jung-gu, Seoul | Main Phone: 02-1234-5678 (Weekdays 09:00~18:00)" : "(04551) 서울특별시 중구 세종대로 110 | 대표전화: 02-1234-5678 (평일 09:00~18:00)"}
        serviceLine={en ? "This service manages greenhouse gas reduction performance in accordance with relevant laws." : "본 서비스는 관계 법령에 의거하여 온실가스 감축 성과를 관리합니다."}
        footerLinks={en ? ["Privacy Policy", "Terms of Use", "Sitemap", "Rejection of Unauthorized Email Collection", "Directions"] : ["개인정보처리방침", "이용약관", "사이트맵", "이메일무단수집거부", "찾아오시는 길"]}
        copyright="© 2025 CCUS Carbon Footprint Platform. All rights reserved."
        lastModifiedLabel={en ? "Last Modified:" : "최종 수정일:"}
        waAlt={en ? "Web Accessibility Quality Certification Mark" : "웹 접근성 품질인증 마크"}
      />
    </div>
  );
}
