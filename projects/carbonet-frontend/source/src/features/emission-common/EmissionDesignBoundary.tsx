import type { ReactNode } from "react";
import { CurrentEmissionContract } from './currentEmissionContract';
import "./emission-design.css";

/** Route-owned presentation only: never changes permissions, API calls or report print layout. */
export function EmissionDesignBoundary({ routePath, children }: { routePath: string; children: ReactNode }) {
  const path = routePath.split("?")[0].replace(/^\/en\//, "/").replace(/\/$/, "");
  const emission = /^\/(admin\/)?emission\//.test(path);
  const separateDesign = /\/(survey-[^/]*|lca|lci|lci-classification|ecoinvent|reduction|simulate)$/.test(path);
  return <div className={emission && !separateDesign ? "ccus-emission-design" : undefined} style={{ display: "contents" }} data-emission-design={emission && !separateDesign ? "krds-workspace-v1" : undefined}>{children}</div>;
}
