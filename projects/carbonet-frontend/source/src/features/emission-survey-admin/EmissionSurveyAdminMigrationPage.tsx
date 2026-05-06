// ... (상단 생략) ...

import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { fetchEmissionSurveyAdminPage } from "../../lib/api/emission";
import type {
  EmissionSurveyAdminPagePayload
} from "../../lib/api/emissionTypes";

export function EmissionSurveyAdminMigrationPage() {
  const pageState = useAsyncValue<EmissionSurveyAdminPagePayload>(() => fetchEmissionSurveyAdminPage(), []);
  
  return (
    <article className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="text-2xl font-bold">Emission Survey Admin</h1>
      <div className="mt-4">{pageState.loading ? "Loading..." : "Loaded"}</div>
    </article>
  );
}

export default EmissionSurveyAdminMigrationPage;
