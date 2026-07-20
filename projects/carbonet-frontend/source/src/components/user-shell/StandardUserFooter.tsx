import { CommonUserFooter } from "./CommonUserFooter";
import { USER_GOV_FOOTER_MARK, USER_GOV_MARK_FALLBACK, USER_WA_MARK } from "./UserPortalChrome";

export type StandardUserFooterProps = {
  english?: boolean;
  className?: string;
};

export function StandardUserFooter({ english = false, className = "mt-20" }: StandardUserFooterProps) {
  return (
    <CommonUserFooter
      addressLine={english ? "(04551) 110 Sejong-daero, Jung-gu, Seoul, Korea" : "(04551) 서울특별시 중구 세종대로 110"}
      className={className}
      copyright="© 2026 CCUS Carbon Management Platform. All rights reserved."
      footerLinks={english ? ["Privacy Policy", "Terms of Use", "Sitemap"] : ["개인정보처리방침", "이용약관", "사이트맵"]}
      governmentMarkFallbackSrc={USER_GOV_MARK_FALLBACK}
      governmentMarkSrc={USER_GOV_FOOTER_MARK}
      lastModifiedLabel={english ? "Last modified" : "최종 수정일"}
      orgName={english ? "CCUS Integrated Management Office" : "CCUS 통합관리본부"}
      serviceLine={english ? "Integrated support for carbon emissions, LCA, reduction, and certification services." : "탄소배출·LCA·감축·인증 업무를 통합 지원합니다."}
      waAlt={english ? "Web accessibility certification" : "웹 접근성 품질인증"}
      waMarkSrc={USER_WA_MARK}
    />
  );
}
