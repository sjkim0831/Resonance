import {
  UserGovernmentBar,
  UserLanguageToggle,
  UserPortalFooter,
  UserPortalHeader
} from "../../components/user-shell/UserPortalChrome";
import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { fetchHomeMenuPlaceholderPage } from "../../lib/api/appBootstrap";
import type { HomeMenuPlaceholderPagePayload } from "../../lib/api/appBootstrapTypes";
import { buildLocalizedPath, isEnglish, navigate } from "../../lib/navigation/runtime";

function stringOf(value: unknown) {
  return typeof value === "string" ? value : "";
}

export function HomeMenuPlaceholderPage() {
  const en = isEnglish();
  const requestPath = `${window.location.pathname}${window.location.search || ""}`;
  const pageState = useAsyncValue<HomeMenuPlaceholderPagePayload>(
    () => fetchHomeMenuPlaceholderPage(requestPath),
    [requestPath]
  );
  const page = pageState.value;
  const title = stringOf(en ? page?.placeholderTitleEn : page?.placeholderTitle) || (en ? "Menu Screen" : "메뉴 화면");
  const code = stringOf(page?.placeholderCode);
  const url = stringOf(page?.placeholderUrl) || requestPath;
  const icon = stringOf(page?.placeholderIcon) || "web";
  const description = stringOf(page?.placeholderDescription)
    || (en
      ? "This shared screen keeps legacy database menu entries reachable until the detailed service page is migrated."
      : "기존 DB 메뉴를 접근 가능하게 유지하는 공통 화면이며, 상세 서비스 페이지 이관 전까지 사용됩니다.");

  return (
    <div className="bg-[var(--kr-gov-bg-gray)] text-[var(--kr-gov-text-primary)] min-h-screen flex flex-col">
      <UserGovernmentBar
        governmentText={en ? "Official Government Service of the Republic of Korea" : "대한민국 정부 공식 서비스"}
        guidelineText={en ? "This website complies with the 2025 Digital Government UI/UX Guidelines." : "이 누리집은 2025 디지털 정부 UI/UX 가이드라인을 준수합니다."}
      />
      <UserPortalHeader
        brandTitle={en ? "CCUS Portal" : "CCUS 통합관리 포털"}
        brandSubtitle="Carbon Capture, Utilization and Storage"
        homeHref={buildLocalizedPath("/home", "/en/home")}
        rightContent={(
          <UserLanguageToggle
            en={en}
            onKo={() => navigate("/home")}
            onEn={() => navigate("/en/home")}
          />
        )}
      />
      <main className="max-w-7xl mx-auto w-full px-4 lg:px-8 py-10 flex-1">
        {pageState.error ? (
          <div className="mb-4 rounded-[var(--kr-gov-radius)] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {pageState.error}
          </div>
        ) : null}
        <section className="gov-card max-w-4xl mx-auto" data-help-id="home-menu-placeholder-card">
          <div className="flex items-start gap-4">
            <span className="material-symbols-outlined text-[42px] text-[var(--kr-gov-blue)]">{icon}</span>
            <div>
              <h2 className="text-3xl font-black mb-2">{title}</h2>
              <p className="text-sm text-[var(--kr-gov-text-secondary)]">{description}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
            <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] p-4">
              <p className="text-xs font-bold text-[var(--kr-gov-text-secondary)] mb-2">{en ? "Menu Code" : "메뉴 코드"}</p>
              <p className="font-bold">{code || "-"}</p>
            </div>
            <div className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] p-4">
              <p className="text-xs font-bold text-[var(--kr-gov-text-secondary)] mb-2">{en ? "Mapped URL" : "연결 URL"}</p>
              <p className="font-bold break-all">{url || "-"}</p>
            </div>
          </div>
        </section>
      </main>
      <UserPortalFooter
        orgName={en ? "CCUS Integrated Management Office" : "CCUS 통합관리본부"}
        addressLine={en ? "(04551) 110 Sejong-daero, Jung-gu, Seoul, Korea" : "(04551) 서울특별시 중구 세종대로 110"}
        serviceLine={en ? "This service manages greenhouse gas reduction performance in accordance with relevant laws." : "본 서비스는 관계 법령에 의거하여 온실가스 감축 성과를 관리합니다."}
        footerLinks={en ? ["Privacy Policy", "Terms of Use", "Sitemap", "Email Collection Refusal"] : ["개인정보처리방침", "이용약관", "사이트맵", "이메일무단수집거부"]}
        copyright="© 2025 CCUS Carbon Footprint Platform. All rights reserved."
        lastModifiedLabel={en ? "Last Modified:" : "최종 수정일:"}
        waAlt={en ? "Web Accessibility Quality Mark" : "웹 접근성 품질인증 마크"}
      />
    </div>
  );
}
