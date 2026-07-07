import { useEffect } from "react";
import { logGovernanceScope } from "../../app/policy/debug";
import { SystemSecurityHistoryMigrationPage } from "./SystemSecurityHistoryMigrationPage";

export function SecurityHistoryMigrationPage() {
  useEffect(() => {
    logGovernanceScope("PAGE", "security-history", {
      wrapper: "SecurityHistoryMigrationPage",
      delegatesTo: "SystemSecurityHistoryMigrationPage"
    });
  }, []);

  return <SystemSecurityHistoryMigrationPage />;
}
