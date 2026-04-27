import { useEffect } from "react";
import { logGovernanceScope } from "../../app/policy/debug";
import { fetchMemberSecurityHistoryPage } from "../../lib/api/security";
import { LoginHistorySharedPage } from "./LoginHistorySharedPage";

export function MemberSecurityHistoryMigrationPage() {
  useEffect(() => {
    logGovernanceScope("PAGE", "member-security-history", {
      wrapper: "MemberSecurityHistoryMigrationPage",
      fixedLoginResult: "FAIL"
    });
  }, []);

  return (
    <LoginHistorySharedPage
      titleKo="접근 차단 이력"
      titleEn="Access Block History"
      subtitleKo="회원 접근 차단 이력과 차단 사유를 조회합니다."
      subtitleEn="Review member access block history and block reasons."
      breadcrumbsKo={["홈", "회원관리", "접근 차단 이력"]}
      breadcrumbsEn={["Home", "Member Management", "Access Block History"]}
      fetchPage={async (params) => fetchMemberSecurityHistoryPage(params)}
      fixedLoginResult="FAIL"
      routeScope="member"
      variant="blocked"
    />
  );
}
