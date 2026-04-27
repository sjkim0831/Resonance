import { useEffect } from "react";
import { logGovernanceScope } from "../../app/policy/debug";
import { fetchLoginHistoryPage } from "../../lib/api/security";
import { LoginHistorySharedPage } from "../security-history/LoginHistorySharedPage";

export function LoginHistoryMigrationPage() {
  useEffect(() => {
    logGovernanceScope("PAGE", "login-history", {
      wrapper: "LoginHistoryMigrationPage",
      fixedLoginResult: ""
    });
  }, []);

  return (
    <LoginHistorySharedPage
      titleKo="로그인 이력"
      titleEn="Login History"
      subtitleKo="관리자 시스템 로그인 이력과 결과를 조회합니다."
      subtitleEn="Review administrator login records and results."
      breadcrumbsKo={["홈", "회원관리", "로그인 이력"]}
      breadcrumbsEn={["Home", "Member Management", "Login History"]}
      fetchPage={fetchLoginHistoryPage}
    />
  );
}
