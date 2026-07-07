import { GOV_SYMBOL, handleGovSymbolError } from "./EmissionProjectListTypes";

interface FooterProps {
  en: boolean;
}

export function EmissionProjectListFooter({ en }: FooterProps) {
  const currentYear = new Date().getFullYear();

  const footerLinks = {
    about: [
      { label: en ? "About System" : "시스템 소개", href: "#" },
      { label: en ? "How to Use" : "이용 안내", href: "#" },
      { label: en ? "FAQ" : "자주 묻는 질문", href: "#" }
    ],
    resources: [
      { label: en ? "Download Manual" : "매뉴얼 다운로드", href: "#" },
      { label: en ? "API Documentation" : "API 문서", href: "#" },
      { label: en ? "Training Materials" : "교육 자료", href: "#" }
    ],
    legal: [
      { label: en ? "Privacy Policy" : "개인정보처리방침", href: "#" },
      { label: en ? "Terms of Use" : "이용약관", href: "#" },
      { label: en ? "Copyright" : "저작권 안내", href: "#" }
    ]
  };

  return (
    <footer className="bg-white border-t border-gray-200">
      <div className="max-w-[1440px] mx-auto px-4 lg:px-8 pt-14 pb-8">
        {/* Main Footer Content */}
        <div className="flex flex-col lg:flex-row justify-between gap-10 pb-10 border-b border-gray-100">
          {/* Brand Section */}
          <div className="space-y-5 max-w-md">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--kr-gov-blue)] to-blue-600 flex items-center justify-center">
                <span className="material-symbols-outlined text-white text-xl">eco</span>
              </div>
              <div>
                <div className="font-black text-gray-900">
                  {en ? "Carbon Emission Management System" : "탄소 배출량 관리 시스템"}
                </div>
                <div className="text-xs text-gray-500">CCUS 통합관리본부</div>
              </div>
            </div>
            <address className="not-italic text-sm text-gray-500 leading-relaxed">
              {en
                ? "(04551) 110 Sejong-daero, Jung-gu, Seoul | Site Management Support Team: 02-1234-5678"
                : "(04551) 서울특별시 중구 세종대로 110 | 현장 관리 지원팀: 02-1234-5678"}
            </address>
            <div className="flex items-center gap-4">
              <img
                alt={en ? "Government symbol" : "대한민국 정부 상징"}
                className="h-8 grayscale opacity-50"
                data-fallback-applied="0"
                onError={handleGovSymbolError}
                src={GOV_SYMBOL}
              />
              <img
                alt={en ? "Web accessibility certification mark" : "웹 접근성 품질인증 마크"}
                className="h-10 opacity-60"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuAzkKwREcbsB7LV3B2b7fBK7y2M_9Exa0vlGVzxNy2qM0n1LFMRlBCIa_XiIBeCfvv3DkMb9Z0D05Y-RMuAytisqlCS8QTpbtebgKnMnWoefEx5uJOgRW5H_8Pw9jmaRvkiW6sVRrifgIhrWc5hi2PRUGHgXn-q8-veHvu9wSwDhtcvbHKYyokgnP-hqdR10ahEAdBe4vFFkR88N_By8pjpp34KH9TwHOouRLBwdfVCsRGmDCS6wnvQZDwf6s4HyScSMXyJJGQjl8Y"
              />
            </div>
          </div>

          {/* Links Sections */}
          <div className="flex flex-wrap gap-x-12 gap-y-8">
            <div>
              <h4 className="font-bold text-gray-900 mb-4">{en ? "About" : "시스템 소개"}</h4>
              <ul className="space-y-3">
                {footerLinks.about.map((link) => (
                  <li key={link.label}>
                    <a className="footer-link text-sm" href={link.href}>
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-gray-900 mb-4">{en ? "Resources" : "자료실"}</h4>
              <ul className="space-y-3">
                {footerLinks.resources.map((link) => (
                  <li key={link.label}>
                    <a className="footer-link text-sm" href={link.href}>
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-gray-900 mb-4">{en ? "Legal" : "법적 고지"}</h4>
              <ul className="space-y-3">
                {footerLinks.legal.map((link) => (
                  <li key={link.label}>
                    <a className="footer-link text-sm" href={link.href}>
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-8 flex flex-col md:flex-row justify-between items-center gap-6">
          <p className="text-xs font-medium text-gray-400">
            © {currentYear} CCUS Carbon Footprint Platform.{" "}
            {en
              ? "Dedicated Site Overseer Portal. All rights reserved."
              : "전용 현장 감독관 포털. 모든 권리 보유."}
          </p>
          <div className="flex items-center gap-4">
            <div className="text-[10px] font-bold text-gray-500 bg-gray-100 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[12px]">smart_toy</span>
              {en ? "V 2.5.0 (AI Assistant Enabled)" : "V 2.5.0 (AI 비서 활성화)"}
            </div>
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1 text-xs text-gray-500">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                {en ? "System Normal" : "시스템 정상"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}