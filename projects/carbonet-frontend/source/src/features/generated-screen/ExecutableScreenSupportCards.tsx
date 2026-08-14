import { CommonContentCard, CommonStatusBadge, CommonTimeline } from "../../components/common-design/CommonDesignPrimitives";

type Row = Record<string, unknown>;

export type VersionedExecutableSupport = {
  actorCode: string;
  contractHash: string;
  processCode: string;
  source: "DB_VERSIONED_CONTRACT";
  stepCode: string;
  support: Row;
  versionId: number;
};

type SupportCardsProps = Omit<VersionedExecutableSupport, "source"> & {
  className?: string;
  en: boolean;
  projectId?: string;
  source?: "DB_VERSIONED_CONTRACT";
  tenantId?: string;
};

const REQUIRED_SCENARIOS = ["HAPPY_PATH", "AUTHORITY", "ISOLATION", "EXCEPTION", "RECOVERY"];
const REQUIRED_LANES = ["API", "DATABASE", "DESIGN_CARD", "FRONTEND", "HELP", "QA", "WORK_GUIDE"];
const REQUIRED_TEST_GATES = [
  "apiVerified",
  "databaseVerified",
  "authorityVerified",
  "responsiveVerified",
  "accessibilityVerified",
  "exceptionStatesVerified",
];
const OBJECT_LANE_ALIASES = [
  ["DESIGN_CARD", "designCard"],
  ["HELP", "help"],
  ["QA", "qa"],
  ["WORK_GUIDE", "workGuide"],
] as const;
const text = (value: unknown) => typeof value === "string" ? value : "";
const record = (value: unknown): Row => value && typeof value === "object" && !Array.isArray(value) ? value as Row : {};
const rows = (value: unknown): Row[] => Array.isArray(value) ? value.filter((item) => item && typeof item === "object") as Row[] : [];

function invalid(reason: string): never {
  throw new Error(`VERSIONED_SUPPORT_CONTRACT_INCOMPLETE:${reason}`);
}

export function requireVersionedExecutableSupport(
  rawEnvelope: unknown,
  expected: { actorCode: string; processCode: string; stepCode: string },
): VersionedExecutableSupport {
  const envelope = record(rawEnvelope);
  const contract = record(envelope.contract);
  const screen = record(contract.screen);
  const process = record(contract.process);
  const permission = record(contract.permission);
  const support = record(contract.support);
  const testContract = record(contract.test);
  const help = record(support.help);
  const workGuide = record(support.workGuide);
  const qa = record(support.qa);
  const designCard = record(support.designCard);
  const lanes = record(support.lanes);
  const processCode = text(process.processCode).toUpperCase();
  const stepCode = text(process.stepCode).toUpperCase();
  const actorCode = text(permission.actorCode).toUpperCase();
  const contractHash = text(envelope.contractHash).toLowerCase();
  const versionId = Number(envelope.versionId);
  const scenarios = Array.isArray(qa.requiredScenarioTypes) ? qa.requiredScenarioTypes.map(String) : [];
  const qaChecks = rows(qa.checks);

  if (envelope.source !== "DB_VERSIONED_CONTRACT") invalid("source");
  if (processCode !== expected.processCode.trim().toUpperCase()) invalid("processCode");
  if (stepCode !== expected.stepCode.trim().toUpperCase()) invalid("stepCode");
  if (actorCode !== expected.actorCode.trim().toUpperCase()) invalid("actorCode");
  if (text(screen.audience).toUpperCase() !== "USER") invalid("audience");
  if (text(permission.audience).toUpperCase() !== "USER") invalid("permission.audience");
  if (text(screen.route).split("?", 1)[0].toLowerCase() !== "/work/execution") invalid("routePath");
  if (!Number.isSafeInteger(versionId) || versionId < 1) invalid("versionId");
  if (!/^[0-9a-f]{32}$/.test(contractHash)) invalid("contractHash");
  if (support.schemaVersion !== "carbonet.executable-screen-support/v1") invalid("schemaVersion");
  if (rows(help.items).length < 1) invalid("help.items");
  if (text(workGuide.processCode).toUpperCase() !== processCode
      || text(workGuide.stepCode).toUpperCase() !== stepCode
      || text(workGuide.actorCode).toUpperCase() !== actorCode) invalid("workGuide.coordinate");
  if (rows(workGuide.steps).length < 1) invalid("workGuide.steps");
  if (text(record(workGuide.nextAction).routePath).split("?", 1)[0].toLowerCase() !== "/work/execution") invalid("workGuide.nextAction");
  if (scenarios.length !== REQUIRED_SCENARIOS.length
      || !REQUIRED_SCENARIOS.every((scenario) => scenarios.includes(scenario))) invalid("qa.requiredScenarioTypes");
  if (qaChecks.length < 1 || !qaChecks.every((check) => check.passed === true)) invalid("qa.checks");
  if (designCard.designSystem !== "KRDS") invalid("designCard.designSystem");
  if (!Object.keys(record(designCard.specification)).length || !Object.keys(record(designCard.traceability)).length) invalid("designCard.contract");
  if (rows(designCard.assetBindings).length < 1) invalid("designCard.assetBindings");
  if (!REQUIRED_TEST_GATES.every((gate) => testContract[gate] === true)) invalid("test.gates");
  const laneKeys = Object.keys(lanes).sort();
  if (laneKeys.length !== REQUIRED_LANES.length
      || !REQUIRED_LANES.every((lane) => laneKeys.includes(lane))) invalid("support.lanes");
  if (!Array.isArray(lanes.API) || lanes.API.length < 1
      || !Array.isArray(lanes.DATABASE) || lanes.DATABASE.length < 1) invalid("support.dataLanes");
  if (!Object.keys(record(lanes.FRONTEND)).length) invalid("support.frontendLane");
  if (!OBJECT_LANE_ALIASES.every(([lane, alias]) => Object.keys(record(lanes[lane])).length
      && JSON.stringify(lanes[lane]) === JSON.stringify(support[alias]))) invalid("support.laneAliases");

  return { actorCode, contractHash, processCode, source: "DB_VERSIONED_CONTRACT", stepCode, support, versionId };
}

function actionHref(routePath: string, context: Record<string, string>) {
  const query = new URLSearchParams(Object.entries(context).filter(([, value]) => value));
  if (!query.size) return routePath;
  return `${routePath}${routePath.includes("?") ? "&" : "?"}${query}`;
}

export function ExecutableScreenSupportCards({
  actorCode,
  className = "",
  contractHash,
  en,
  processCode,
  projectId = "",
  source,
  stepCode,
  support,
  tenantId = "",
  versionId,
}: SupportCardsProps) {
  const workGuide = record(support.workGuide);
  const guideSteps = rows(workGuide.steps);
  const nextAction = record(workGuide.nextAction);
  const nextRoute = text(nextAction.routePath);
  const qa = record(support.qa);
  const qaScenarios = Array.isArray(qa.requiredScenarioTypes) ? qa.requiredScenarioTypes.map(String) : [];
  const qaChecks = rows(qa.checks);
  const designCard = record(support.designCard);
  const designAssets = rows(designCard.assetBindings);
  const assetBindings = designAssets.length ? designAssets : rows(support.assetBindings);
  const isVersioned = source === "DB_VERSIONED_CONTRACT" && versionId > 0 && /^[0-9a-f]{32}$/i.test(contractHash);
  const openFullWorkflow = () => window.dispatchEvent(new CustomEvent("resonance:task-guide-focus", {
    detail: { processCode, stepCode, projectId, openOverview: true },
  }));

  return <section
    className={className}
    data-actor-code={actorCode}
    data-contract-hash={contractHash}
    data-process-code={processCode}
    data-required-scenario-count={String(qaScenarios.length)}
    data-support-source={isVersioned ? source : "STATIC_FALLBACK"}
    data-step-code={stepCode}
    data-version-id={String(versionId)}
    data-versioned-support-contract={isVersioned ? "" : undefined}
  >
    <CommonTimeline title={en ? "Work guide" : "업무 길잡이"}>
      {guideSteps.map((step, index) => <div className="relative pl-5" key={text(step.code) || `${stepCode}-${index}`}>
        <span aria-hidden="true" className="absolute -left-1.5 top-1.5 h-3 w-3 rounded-full bg-[#246beb]" />
        <p className="gov-text-label font-black text-[#052b57]">{Number(step.order) || index + 1}. {text(step.name) || text(step.label) || text(step.code)}</p>
        {text(step.completionRule) && <p className="gov-text-body-sm mt-1 text-slate-600">{text(step.completionRule)}</p>}
      </div>)}
      <div className="relative ml-5 flex flex-wrap gap-2">
        {nextRoute && <a
          className="krds-control inline-flex items-center rounded-lg bg-[#246beb] px-4 font-black text-white"
          data-support-next-action=""
          href={actionHref(nextRoute, { tenantId, projectId, processCode, stepCode, guide: "1" })}
        >{en ? "Continue next task" : "다음 업무 진행"}<span className="sr-only"> · {text(nextAction.label)}</span></a>}
        <button
          className="krds-control rounded-lg border border-[#246beb] bg-white px-4 font-black text-[#246beb]"
          data-support-full-workflow=""
          onClick={openFullWorkflow}
          type="button"
        >{en ? "View full workflow" : "전체 업무 보기"}</button>
      </div>
    </CommonTimeline>
    <CommonContentCard className="p-5">
      <h2 className="gov-text-heading-sm font-black text-[#052b57]">{en ? "QA verification" : "QA 검증"}</h2>
      <div className="mt-3 flex flex-wrap gap-2">{qaScenarios.map((scenario) => <CommonStatusBadge className="bg-blue-50 text-blue-800" key={scenario}>{scenario}</CommonStatusBadge>)}</div>
      <ul className="mt-4 space-y-2">{qaChecks.map((check, index) => {
        const passed = check.passed === true;
        const failed = check.passed === false;
        const status = passed ? (en ? "Passed" : "통과") : failed ? (en ? "Failed" : "실패") : (en ? "Not verified" : "미확인");
        return <li
          aria-label={`${text(check.label) || text(check.code)}: ${status}`}
          className={`gov-text-body-sm flex gap-2 ${passed ? "text-emerald-800" : failed ? "text-red-700" : "text-slate-600"}`}
          key={text(check.code) || `QA-${index}`}
        ><span aria-hidden="true">{passed ? "✓" : failed ? "✕" : "?"}</span><span>{text(check.label) || text(check.code)} · {status}</span></li>;
      })}</ul>
    </CommonContentCard>
    <CommonContentCard className="p-5">
      <div className="flex items-start justify-between gap-3"><h2 className="gov-text-heading-sm font-black text-[#052b57]">{en ? "Design summary" : "화면 설계 요약"}</h2><CommonStatusBadge className="bg-slate-100 text-slate-700">{text(designCard.designSystem) || "KRDS"}</CommonStatusBadge></div>
      <dl className="gov-text-body-sm mt-4 grid grid-cols-[auto_1fr] gap-x-3 gap-y-2">
        <dt className="font-bold text-slate-500">{en ? "Type" : "화면 유형"}</dt><dd>{text(designCard.screenType) || "-"}</dd>
        <dt className="font-bold text-slate-500">{en ? "Template" : "템플릿"}</dt><dd>{text(designCard.templateCode) || "-"}</dd>
        <dt className="font-bold text-slate-500">{en ? "Assets" : "공통 자산"}</dt><dd>{assetBindings.length}</dd>
        <dt className="font-bold text-slate-500">Version</dt><dd>v{versionId}</dd>
        <dt className="font-bold text-slate-500">Contract hash</dt><dd className="break-all font-mono text-xs">{contractHash}</dd>
      </dl>
    </CommonContentCard>
  </section>;
}
