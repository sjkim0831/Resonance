import { lazy, Suspense } from "react";
import { useRuntimeNavigation } from "../../app/hooks/useRuntimeNavigation";
import { JoinCompanyReapplyMigrationPage } from "./JoinCompanyReapplyMigrationPage";

const FullApplication = lazy(() => import("../../App"));

export function JoinCompanyReapplyEntry() {
  const { page } = useRuntimeNavigation();

  if (page === "join-company-reapply") {
    return <JoinCompanyReapplyMigrationPage />;
  }

  return (
    <Suspense fallback={<main aria-busy="true" className="p-6">화면을 불러오는 중입니다.</main>}>
      <FullApplication />
    </Suspense>
  );
}
