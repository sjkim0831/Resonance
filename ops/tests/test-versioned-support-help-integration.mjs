#!/usr/bin/env node
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const testRoot = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(process.env.RESONANCE_ROOT || path.join(testRoot, "../.."));
const file = (relative) => readFileSync(path.join(root, relative), "utf8");
const sources = {
  support: file("projects/carbonet-frontend/source/src/features/generated-screen/ExecutableScreenSupportCards.tsx"),
  overlay: file("projects/carbonet-frontend/source/src/components/help/HelpOverlay.tsx"),
  generated: file("projects/carbonet-frontend/source/src/features/generated-screen/GeneratedScreenPage.tsx"),
  work: file("projects/carbonet-frontend/source/src/features/work-execution/WorkExecutionPage.tsx"),
  harness: file("ops/scripts/resonance-member-lifecycle-relay-e2e.mjs"),
  pipeline: file("projects/carbonet-frontend/source/scripts/run-frontend-pipeline.mjs"),
  pipelineShell: file("ops/scripts/test-frontend-parallel-build-pipeline.sh"),
};

const required = [
  ["validated audience", "support", 'audience: "USER";'],
  ["validated marker type", "support", 'validation: "EXACT_DB_VERSIONED_SUPPORT";'],
  ["validated marker return", "support", 'validation: "EXACT_DB_VERSIONED_SUPPORT", versionId'],
  ["validated marker render gate", "support", 'validation === "EXACT_DB_VERSIONED_SUPPORT"'],
  ["DB help authority", "support", "const supportHelp = record(support.help);"],
  ["DB help title", "support", "title: text(supportHelp.title)"],
  ["DB help summary", "support", "summary: text(supportHelp.summary)"],
  ["DB help item sequence", "support", "items: rows(supportHelp.items).map(toVersionedHelpItem)"],
  ["scoped trigger source", "support", 'data-versioned-support-help=""'],
  ["coordinate reset key", "support", "key={helpBindingKey}"],
  ["anchor selector grammar", "support", "VERSIONED_HELP_ANCHOR_SELECTOR"],
  ["anchor selector fail close", "support", 'if (!helpItems.every((item) => isValidVersionedHelpAnchorSelector(item.anchorSelector))) invalid("help.anchorSelector");'],
  ["overlay selector exception guard", "overlay", "try {\n      element = document.querySelector(activeItem.anchorSelector);\n    } catch {\n      return;"],
  ["dialog hash", "overlay", "data-contract-hash={versionedBinding?.contractHash}"],
  ["dialog version", "overlay", "data-version-id={versionedBinding ? String(versionedBinding.versionId) : undefined}"],
  ["dialog process", "overlay", "data-process-code={versionedBinding?.processCode}"],
  ["dialog step", "overlay", "data-step-code={versionedBinding?.stepCode}"],
  ["dialog actor", "overlay", "data-actor-code={versionedBinding?.actorCode}"],
  ["dialog audience", "overlay", "data-audience={versionedBinding?.audience}"],
  ["dialog source", "overlay", "data-support-source={versionedBinding?.source}"],
  ["dialog executable", "overlay", 'data-screen-classification={versionedBinding ? "EXECUTABLE" : undefined}'],
  ["dialog unrestricted", "overlay", 'data-screen-access-restricted={versionedBinding ? "false" : undefined}'],
  ["dialog marker", "overlay", 'data-versioned-support-help-dialog={versionedBinding ? "" : undefined}'],
  ["dialog help title attr", "overlay", "data-help-title={versionedBinding ? helpContent.title : undefined}"],
  ["dialog help summary attr", "overlay", "data-help-summary={versionedBinding ? helpContent.summary : undefined}"],
  ["dialog help item count attr", "overlay", "data-help-item-count={versionedBinding ? String(helpContent.items.length) : undefined}"],
  ["overlay renders help title", "overlay", '<h2 id="help-overlay-title">{helpContent.title}</h2>'],
  ["overlay renders help summary", "overlay", '<p className="state-text">{helpContent.summary}</p>'],
  ["overlay renders item title", "overlay", "<h3>{activeItem.title}</h3>"],
  ["overlay renders item body", "overlay", "<p>{activeItem.body}</p>"],
  ["work context route", "support", 'routePath: "/work/execution"'],
  ["work context classification", "support", 'classification: "EXECUTABLE"'],
  ["work context unrestricted", "support", "accessRestricted: false"],
  ["work context audience", "support", "identity: { audience, projectId }"],
  ["work context process and step", "support", "workflow: {\n      processCode,\n      stepCode,"],
  ["work context actor", "support", "      actorCode,\n      actorName:"],
  ["work validated object spread", "work", "<ExecutableScreenSupportCards\n      {...versionedSupport}"],
  ["generated audience propagation", "generated", "audience={screen.audience}"],
  ["harness root scoped trigger", "harness", "const helpButton = supportRoot.locator('button[data-versioned-support-help]')"],
  ["harness global uniqueness", "harness", "page.locator('button[data-versioned-support-help]').count() !== 1"],
  ["harness versioned dialog", "harness", "page.locator('[role=\"dialog\"][data-versioned-support-help-dialog]')"],
  ["harness dialog hash", "harness", 'requireExactAttribute(helpDialog, "data-contract-hash", supportContract.contractHash, "help hash")'],
  ["harness dialog version", "harness", 'requireExactAttribute(helpDialog, "data-version-id", String(supportContract.versionId), "help version")'],
  ["harness dialog process", "harness", 'requireExactAttribute(helpDialog, "data-process-code", processCode, "help process")'],
  ["harness dialog step", "harness", 'requireExactAttribute(helpDialog, "data-step-code", step.stepCode, "help step")'],
  ["harness dialog actor", "harness", 'requireExactAttribute(helpDialog, "data-actor-code", step.actorCode, "help actor")'],
  ["harness dialog audience", "harness", 'requireExactAttribute(helpDialog, "data-audience", supportContract.audience, "help audience")'],
  ["harness dialog source", "harness", 'requireExactAttribute(helpDialog, "data-support-source", "DB_VERSIONED_CONTRACT", "help source")'],
  ["harness dialog classification", "harness", 'requireExactAttribute(helpDialog, "data-screen-classification", "EXECUTABLE", "help classification")'],
  ["harness dialog unrestricted", "harness", 'requireExactAttribute(helpDialog, "data-screen-access-restricted", "false", "help unrestricted access")'],
  ["harness dialog title attr", "harness", 'requireExactAttribute(helpDialog, "data-help-title", supportContract.help.title, "help title")'],
  ["harness dialog summary attr", "harness", 'requireExactAttribute(helpDialog, "data-help-summary", supportContract.help.summary, "help summary")'],
  ["harness dialog item count attr", "harness", 'requireExactAttribute(helpDialog, "data-help-item-count", String(supportContract.help.itemCount), "help item count")'],
  ["harness visible help title", "harness", 'getByRole("heading", { name: supportContract.help.title, exact: true })'],
  ["harness visible help summary", "harness", "getByText(supportContract.help.summary, { exact: true })"],
  ["harness help item retention", "harness", "items: help.items.map((item) => ({"],
  ["harness all help traversal", "harness", "for (const [helpIndex, helpItem] of supportContract.help.items.entries())"],
  ["harness visible item title", "harness", 'getByRole("heading", { name: helpItem.title, exact: true })'],
  ["harness visible item body", "harness", "getByText(helpItem.body, { exact: true })"],
  ["harness next item", "harness", "await nextHelpItem.click();"],
  ["home fetch observer", "harness", '["/api/home", "/en/api/home"].includes(candidateUrl.pathname)'],
  ["home fetch exact one", "harness", "if (homeFetchCount !== 1)"],
  ["failure URL", "harness", "url=${safeError(page?.url()"],
  ["failure pageerror", "harness", "pageerror=${runtimeErrors.join"],
  ["failure console", "harness", "console=${consoleErrors.join"],
  ["failure requestfailed", "harness", "requestfailed=${failedRequests.join"],
  ["failure home count", "harness", "homeFetchCount=${homeFetchCount}"],
  ["harness anchor grammar", "harness", "const helpAnchorSelector ="],
  ["close failure diagnostic retention", "harness", "if (!uiFailure) throw uiDiagnostic(closeReason);"],
  ["context close finally", "harness", "await uiContext.close();"],
  ["context registry delete finally", "harness", "browserContexts.delete(uiContext);"],
  ["automatic pipeline gate", "pipeline", "ops/tests/test-versioned-support-help-integration.mjs"],
  ["pipeline wiring guard", "pipelineShell", "ops/tests/test-versioned-support-help-integration.mjs"],
];

function violations(candidate) {
  const failed = required
    .filter(([, source, token]) => !candidate[source].includes(token))
    .map(([name]) => name);
  if ((candidate.support.match(/data-versioned-support-help=""/g) || []).length !== 1) failed.push("single trigger source");
  if (/getPageHelpContent|PAGE_HELP\[/.test(candidate.support)) failed.push("no registry help fallback");
  if (/data-versioned-support-help/.test(candidate.generated) || /data-versioned-support-help/.test(candidate.work)) failed.push("no trigger outside support root");
  if (candidate.generated.includes("EXACT_DB_VERSIONED_SUPPORT")) failed.push("generated cannot self validate");
  const diagnosticAt = candidate.harness.indexOf("const uiDiagnostic =");
  const catchAt = candidate.harness.indexOf("} catch (reason) {", diagnosticAt);
  const retainAt = candidate.harness.indexOf("uiFailure = uiDiagnostic(reason);", catchAt);
  const finallyAt = candidate.harness.indexOf("} finally {", retainAt);
  const closeAt = candidate.harness.indexOf("await uiContext.close();", finallyAt);
  const closeCatchAt = candidate.harness.indexOf("} catch (closeReason) {", closeAt);
  const preserveAt = candidate.harness.indexOf("if (!uiFailure) throw uiDiagnostic(closeReason);", closeCatchAt);
  const deleteFinallyAt = candidate.harness.indexOf("} finally {", preserveAt);
  const deleteAt = candidate.harness.indexOf("browserContexts.delete(uiContext);", deleteFinallyAt);
  const scopedDeleteFinally = candidate.harness.includes("} finally {\n          browserContexts.delete(uiContext);");
  if (!(scopedDeleteFinally
      && diagnosticAt >= 0 && catchAt > diagnosticAt && retainAt > catchAt && finallyAt > retainAt
      && closeAt > finallyAt && closeCatchAt > closeAt && preserveAt > closeCatchAt && deleteFinallyAt > preserveAt && deleteAt > deleteFinallyAt)) {
    failed.push("diagnostic catch before disposal finally");
  }
  return [...new Set(failed)];
}

const frontendRequire = createRequire(
  path.join(root, "projects/carbonet-frontend/source/package.json"),
);
const typescript = frontendRequire("typescript");
function syntaxErrors(source, fileName) {
  return (typescript.transpileModule(source, {
    fileName,
    reportDiagnostics: true,
    compilerOptions: {
      jsx: typescript.JsxEmit.ReactJSX,
      module: typescript.ModuleKind.ESNext,
      target: typescript.ScriptTarget.ES2022,
    },
  }).diagnostics || []).filter(
    (diagnostic) => diagnostic.category === typescript.DiagnosticCategory.Error,
  );
}
for (const [name, source] of [["ExecutableScreenSupportCards.tsx", sources.support], ["HelpOverlay.tsx", sources.overlay], ["GeneratedScreenPage.tsx", sources.generated]]) {
  assert.equal(syntaxErrors(source, name).length, 0, name + " must parse as TSX");
}

assert.deepEqual(violations(sources), [], "versioned help integration contract is incomplete");

let mutants = 0;
function mutate(label, source, needle, replacement, expectedViolation) {
  assert(sources[source].includes(needle), `${label} mutation fixture is missing`);
  const mutant = { ...sources, [source]: sources[source].replace(needle, replacement) };
  mutants += 1;
  assert(violations(mutant).includes(expectedViolation), `${label} mutant survived; got ${violations(mutant).join(",") || "none"}`);
}

mutate("global help fab", "harness",
  "const helpButton = supportRoot.locator('button[data-versioned-support-help]')",
  'const helpButton = page.locator("button.help-fab")', "harness root scoped trigger");
mutate("static help substitution", "support", "const supportHelp = record(support.help);",
  'const supportHelp = record({ title: "static", summary: "static", items: [] });', "DB help authority");
for (const [label, needle, replacement, violation] of [
  ["hash", "data-contract-hash={versionedBinding?.contractHash}", 'data-contract-hash="static"', "dialog hash"],
  ["version", "data-version-id={versionedBinding ? String(versionedBinding.versionId) : undefined}", 'data-version-id="0"', "dialog version"],
  ["process", "data-process-code={versionedBinding?.processCode}", 'data-process-code="OTHER"', "dialog process"],
  ["step", "data-step-code={versionedBinding?.stepCode}", 'data-step-code="OTHER"', "dialog step"],
  ["actor", "data-actor-code={versionedBinding?.actorCode}", 'data-actor-code="OTHER"', "dialog actor"],
  ["audience", "data-audience={versionedBinding?.audience}", 'data-audience="ADMIN"', "dialog audience"],
]) mutate(`${label} miswire`, "overlay", needle, replacement, violation);
mutate("restricted dialog", "overlay", 'data-screen-access-restricted={versionedBinding ? "false" : undefined}',
  'data-screen-access-restricted={versionedBinding ? "true" : undefined}', "dialog unrestricted");
mutate("review classification", "overlay", 'data-screen-classification={versionedBinding ? "EXECUTABLE" : undefined}',
  'data-screen-classification={versionedBinding ? "REVIEW_REQUIRED" : undefined}', "dialog executable");
mutate("duplicate outside root", "support", "export function ExecutableScreenSupportCards", 'const duplicateHelp = <button data-versioned-support-help="" />;\nexport function ExecutableScreenSupportCards', "single trigger source");
mutate("open reset race", "support", "key={helpBindingKey}", 'key="static-help"', "coordinate reset key");
mutate("unvalidated DB marker", "support", ' && validation === "EXACT_DB_VERSIONED_SUPPORT"', "", "validated marker render gate");
mutate("generated marker spoof", "generated", "audience={screen.audience}", 'audience={screen.audience}\n        validation="EXACT_DB_VERSIONED_SUPPORT"', "generated cannot self validate");
mutate("help traversal removal", "harness", "for (const [helpIndex, helpItem] of supportContract.help.items.entries())", "for (const [helpIndex, helpItem] of supportContract.help.items.slice(0, 1).entries())", "harness all help traversal");
mutate("next item removal", "harness", "await nextHelpItem.click();", "await nextHelpItem.focus();", "harness next item");
mutate("zero home fetch accepted", "harness", "if (homeFetchCount !== 1)", "if (homeFetchCount !== 0)", "home fetch exact one");
mutate("two home fetches accepted", "harness", "if (homeFetchCount !== 1)", "if (homeFetchCount !== 2)", "home fetch exact one");
mutate("invalid selector accepted", "support", "isValidVersionedHelpAnchorSelector(item.anchorSelector)", "true", "anchor selector fail close");
mutate("selector exception escapes", "overlay", "try {\n      element = document.querySelector(activeItem.anchorSelector);\n    } catch {\n      return;",
  "element = document.querySelector(activeItem.anchorSelector);", "overlay selector exception guard");
mutate("dispose before diagnostics", "harness", "uiFailure = uiDiagnostic(reason);", "uiFailure = null;", "diagnostic catch before disposal finally");
mutate("context close skipped", "harness", "try {\n          await uiContext.close();", "try {\n          await Promise.resolve();", "diagnostic catch before disposal finally");
mutate("context registry leak", "harness", "} finally {\n          browserContexts.delete(uiContext);", "} finally {\n          void uiContext;", "diagnostic catch before disposal finally");
mutate("close overwrites diagnostic", "harness", "if (!uiFailure) throw uiDiagnostic(closeReason);",
  "throw uiDiagnostic(closeReason);", "close failure diagnostic retention");
const parserMutant = sources.support.replace(
  "export function ExecutableScreenSupportCards", "export function ExecutableScreenSupportCards(",
);
mutants += 1;
assert(syntaxErrors(parserMutant, "ExecutableScreenSupportCards.tsx").length > 0, "TSX parser mutant survived");

for (const [name, source, token] of required) {
  const mutant = { ...sources, [source]: sources[source].split(token).join("__REMOVED_BY_REQUIRED_MUTANT__") };
  mutants += 1;
  assert(violations(mutant).includes(name), `${name} required mutant survived`);
}

console.log(`VERSIONED_SUPPORT_HELP_INTEGRATION_PASS checks=${required.length + 5} mutants=${mutants} help=DB_EXACT traversal=all homeFetch=1`);
