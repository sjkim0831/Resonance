import { buildCurrentRuntimeComparePath, buildRepairWorkbenchPath, buildScreenRuntimePath } from "./screenBuilderPaths";

type OperatorFlowQuery = {
  menuCode?: string;
  pageId?: string;
  menuTitle?: string;
  menuUrl?: string;
  snapshotVersionId?: string;
  projectId?: string;
};

export type OperatorFlowStep = {
  id: string;
  label: string;
  command: string;
  evidence: string;
};

export function buildScreenBuilderOperatorFlowQuery(query: OperatorFlowQuery): Required<OperatorFlowQuery> {
  return {
    menuCode: query.menuCode || "",
    pageId: query.pageId || "",
    menuTitle: query.menuTitle || "",
    menuUrl: query.menuUrl || "",
    snapshotVersionId: query.snapshotVersionId || "",
    projectId: query.projectId || ""
  };
}

export function buildScreenBuilderOperatorFlowPaths(query: OperatorFlowQuery) {
  const normalized = buildScreenBuilderOperatorFlowQuery(query);
  return {
    runtime: buildScreenRuntimePath(normalized),
    compare: buildCurrentRuntimeComparePath(normalized),
    repair: buildRepairWorkbenchPath(normalized)
  };
}

export function buildScreenBuilderOperatorFlowSteps(query: OperatorFlowQuery): OperatorFlowStep[] {
  const paths = buildScreenBuilderOperatorFlowPaths(query);
  return [
    {
      id: "deploy",
      label: "Build / Package / Restart",
      command: "bash ops/scripts/build-restart-18000.sh",
      evidence: paths.runtime
    },
    {
      id: "freshness",
      label: "Freshness Verify",
      command: "VERIFY_WAIT_SECONDS=20 bash ops/scripts/codex-verify-18000-freshness.sh",
      evidence: "apps/carbonet-app/target/carbonet.jar -> var/run/carbonet-18000.jar -> :18000"
    },
    {
      id: "compare",
      label: "Runtime Compare",
      command: `curl -skI https://127.0.0.1:18000${paths.compare}`,
      evidence: paths.compare
    },
    {
      id: "repair",
      label: "Repair / Rollback Evidence",
      command: `curl -skI https://127.0.0.1:18000${paths.repair}`,
      evidence: paths.repair
    }
  ];
}

export function buildScreenBuilderRuntimeVerificationCommand(query: OperatorFlowQuery) {
  const paths = buildScreenBuilderOperatorFlowPaths(query);
  return `curl -skI https://127.0.0.1:18000${paths.runtime}`;
}

export function buildScreenBuilderRouteVerifyCommands(query: OperatorFlowQuery) {
  const paths = buildScreenBuilderOperatorFlowPaths(query);
  return {
    runtime: `curl -skI https://127.0.0.1:18000${paths.runtime}`,
    compare: `curl -skI https://127.0.0.1:18000${paths.compare}`,
    repair: `curl -skI https://127.0.0.1:18000${paths.repair}`
  };
}
