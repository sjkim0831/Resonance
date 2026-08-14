import { useMemo, useState } from "react";
import { CommonContentCard, CommonStatusBadge, CommonTimeline } from "../../components/common-design/CommonDesignPrimitives";
import { HelpOverlay } from "../../components/help/HelpOverlay";
import type { ScreenWorkContext } from "../runtime-assist/screenWorkContext";
import type { HelpItem, PageHelpContent } from "../../platform/screen-registry/helpContent";

type Row = Record<string, unknown>;

export type VersionedExecutableSupport = {
  audience: "USER";
  actorCode: string;
  contractHash: string;
  processCode: string;
  source: "DB_VERSIONED_CONTRACT";
  stepCode: string;
  support: Row;
  versionId: number;
  validation: "EXACT_DB_VERSIONED_SUPPORT";
};

type SupportCardsProps = Omit<VersionedExecutableSupport, "audience" | "source" | "validation"> & {
  audience?: string;
  validation?: "EXACT_DB_VERSIONED_SUPPORT";
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
const VERSIONED_HELP_ANCHOR_SELECTOR = /^(?:#[A-Za-z][\w:.-]*|\[data-help-id=(?:"[^"\\\r\n]+"|'[^'\\\r\n]+')\])$/;

export function isValidVersionedHelpAnchorSelector(value: unknown): boolean {
  const selector = text(value).trim();
  return selector === "" || VERSIONED_HELP_ANCHOR_SELECTOR.test(selector);
}

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
  const audience = text(screen.audience).toUpperCase();
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
  if (audience !== "USER") invalid("audience");
  if (text(permission.audience).toUpperCase() !== "USER") invalid("permission.audience");
  if (text(screen.route).split("?", 1)[0].toLowerCase() !== "/work/execution") invalid("routePath");
  if (!Number.isSafeInteger(versionId) || versionId < 1) invalid("versionId");
  if (!/^[0-9a-f]{32}$/.test(contractHash)) invalid("contractHash");
  if (support.schemaVersion !== "carbonet.executable-screen-support/v1") invalid("schemaVersion");
  const helpItems = rows(help.items);
  if (!text(help.title).trim()) invalid("help.title");
  if (!text(help.summary).trim()) invalid("help.summary");
  if (helpItems.length < 1) invalid("help.items");
  if (!helpItems.every((item) => text(item.id).trim() && text(item.title).trim() && text(item.body).trim())) invalid("help.itemContent");
  if (!helpItems.every((item) => isValidVersionedHelpAnchorSelector(item.anchorSelector))) invalid("help.anchorSelector");
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

  return { actorCode, audience: "USER", contractHash, processCode, source: "DB_VERSIONED_CONTRACT", stepCode, support, validation: "EXACT_DB_VERSIONED_SUPPORT", versionId };
}

function actionHref(routePath: string, context: Record<string, string>) {
  const query = new URLSearchParams(Object.entries(context).filter(([, value]) => value));
  if (!query.size) return routePath;
  return `${routePath}${routePath.includes("?") ? "&" : "?"}${query}`;
}

type VersionedSupportHelpProps = {
  actorCode: string;
  audience: "USER";
  contractHash: string;
  en: boolean;
  processCode: string;
  projectId: string;
  stepCode: string;
  support: Row;
  versionId: number;
};

function toVersionedHelpItem(item: Row): HelpItem {
  const placement = text(item.placement);
  const highlightStyle = text(item.highlightStyle);
  return {
    id: text(item.id),
    title: text(item.title),
    body: text(item.body),
    anchorSelector: text(item.anchorSelector) || undefined,
    placement: (["top", "right", "bottom", "left"].includes(placement) ? placement : undefined) as HelpItem["placement"],
    imageUrl: text(item.imageUrl) || undefined,
    iconName: text(item.iconName) || undefined,
    highlightStyle: (["focus", "warning", "success", "neutral"].includes(highlightStyle) ? highlightStyle : undefined) as HelpItem["highlightStyle"],
    ctaLabel: text(item.ctaLabel) || undefined,
    ctaUrl: text(item.ctaUrl) || undefined,
  };
}

function VersionedSupportHelp({ actorCode, audience, contractHash, en, processCode, projectId, stepCode, support, versionId }: VersionedSupportHelpProps) {
  const [open, setOpen] = useState(false);
  const supportHelp = record(support.help);
  const workGuide = record(support.workGuide);
  const firstStep = rows(workGuide.steps)[0] || {};
  const helpBindingKey = [contractHash, String(versionId), processCode, stepCode, actorCode, audience].join("\u001f");
  const helpContent = useMemo<PageHelpContent>(() => ({
    pageId: `versioned-support:${helpBindingKey}`,
    title: text(supportHelp.title),
    summary: text(supportHelp.summary),
    items: rows(supportHelp.items).map(toVersionedHelpItem),
  }), [helpBindingKey, supportHelp]);
  const workContext = useMemo<ScreenWorkContext>(() => ({
    linked: true,
    routePath: "/work/execution",
    pageId: helpContent.pageId,
    source: "server",
    classification: "EXECUTABLE",
    accessRestricted: false,
    identity: { audience, projectId },
    workflow: {
      processCode,
      stepCode,
      stepName: text(firstStep.name),
      stepOrder: Number(firstStep.order || workGuide.stepOrder || 0),
      actorCode,
      actorName: text(firstStep.actorName),
      workPurpose: text(workGuide.requirement),
      completionRule: text(workGuide.completionRule),
      inputContract: JSON.stringify(record(workGuide.inputContract)),
      outputContract: JSON.stringify(record(workGuide.outputContract)),
      userPath: "/work/execution",
    },
  }), [actorCode, audience, firstStep, helpContent.pageId, processCode, projectId, stepCode, workGuide]);

  return <>
    <button
      aria-haspopup="dialog"
      className="krds-control inline-flex items-center justify-center rounded-lg border border-[#246beb] bg-white px-4 font-black text-[#246beb]"
      data-versioned-support-help=""
      onClick={() => setOpen(true)}
      type="button"
    >{en ? "Screen help" : "도움말"}</button>
    {open ? <HelpOverlay
      helpContent={helpContent}
      onClose={() => setOpen(false)}
      open={open}
      pageId={helpContent.pageId}
      versionedBinding={{ actorCode, audience, contractHash, processCode, source: "DB_VERSIONED_CONTRACT", stepCode, versionId }}
      workContext={workContext}
    /> : null}
  </>;
}

export function ExecutableScreenSupportCards({
  actorCode,
  className = "",
  contractHash,
  en,
  processCode,
  audience = "",
  projectId = "",
  source,
  stepCode,
  support,
  validation,
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
  const isVersioned = source === "DB_VERSIONED_CONTRACT" && versionId > 0 && /^[0-9a-f]{32}$/i.test(contractHash) && audience === "USER" && validation === "EXACT_DB_VERSIONED_SUPPORT";
  const helpBindingKey = [contractHash, String(versionId), processCode, stepCode, actorCode, audience].join("\u001f");
  const versionedBinding = isVersioned ? {
    actorCode, audience: "USER" as const, contractHash, processCode,
    source: "DB_VERSIONED_CONTRACT" as const, stepCode, support, versionId,
  } : null;
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
    data-audience={audience}
    data-versioned-support-contract={isVersioned ? "" : undefined}
  >
    {versionedBinding ? <div className="flex justify-end lg:col-span-3">
      <VersionedSupportHelp
        {...versionedBinding}
        en={en}
        key={helpBindingKey}
        projectId={projectId}
      />
    </div> : null}
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
