import { useEffect } from "react";
import { logGovernanceScope } from "../../app/policy/debug";
import { fetchSecurityHistoryPage } from "../../lib/api/security";
import { LoginHistorySharedPage } from "./LoginHistorySharedPage";

export function SystemSecurityHistoryMigrationPage() {
  useEffect(() => {
    logGovernanceScope("PAGE", "system-security-history", {
      wrapper: "SystemSecurityHistoryMigrationPage",
      fixedLoginResult: "FAIL"
    });
  }, []);

  return (
    <LoginHistorySharedPage
      titleKo="접근 차단 이력"
      titleEn="Access Block History"
      subtitleKo="IP, 계정 잠금 등 시스템 접근 차단 이력을 조회합니다."
      subtitleEn="Review system access blocks such as IP denial and account lock."
      breadcrumbsKo={["홈", "시스템", "접근 차단 이력"]}
      breadcrumbsEn={["Home", "System", "Access Block History"]}
      fetchPage={async (params) => fetchSecurityHistoryPage(params)}
      fixedLoginResult="FAIL"
      routeScope="system"
      variant="blocked"
    />
  );
}
