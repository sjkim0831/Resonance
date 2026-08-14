import type { FrontendSession } from "../../lib/api/adminShellTypes";

export function canLoadTaskQuestPrivateTasks(
  session: Pick<FrontendSession, "authenticated"> | null | undefined,
): boolean {
  return session?.authenticated === true;
}

export type TaskQuestPrivateLoadEpoch = { current: number };

export function beginTaskQuestPrivateLoad(epoch: TaskQuestPrivateLoadEpoch): number {
  epoch.current += 1;
  return epoch.current;
}

export function invalidateTaskQuestPrivateLoad(epoch: TaskQuestPrivateLoadEpoch): void {
  epoch.current += 1;
}

export function isCurrentTaskQuestPrivateLoad(
  epoch: TaskQuestPrivateLoadEpoch,
  sequence: number,
): boolean {
  return epoch.current === sequence;
}

export type TaskQuestWorkflowCoordinateSource = {
  screenContext?: { processCode?: string | null; stepCode?: string | null } | null;
  route?: { processCode?: string | null; stepCode?: string | null } | null;
  selectedProcessCode?: string | null;
  focused?: { processCode?: string | null; stepCode?: string | null } | null;
  task?: { processCode?: string | null; stepCode?: string | null } | null;
};

function firstNonBlank(...values: Array<string | null | undefined>): string {
  return values.map((value) => String(value || "").trim()).find(Boolean) || "";
}

export function resolveTaskQuestWorkflowCoordinate(
  source: TaskQuestWorkflowCoordinateSource,
): { processCode: string; stepCode: string } {
  return {
    processCode: firstNonBlank(
      source.screenContext?.processCode,
      source.route?.processCode,
      source.selectedProcessCode,
      source.focused?.processCode,
      source.task?.processCode,
    ),
    stepCode: firstNonBlank(
      source.screenContext?.stepCode,
      source.route?.stepCode,
      source.focused?.stepCode,
      source.task?.stepCode,
    ),
  };
}

export function resolveTaskQuestWorkflowDomainCode(
  processDomainCode?: string | null,
  taskDomainCode?: string | null,
  selectedWorkType?: string | null,
): string {
  return firstNonBlank(processDomainCode, taskDomainCode, selectedWorkType, "ALL").toUpperCase();
}
