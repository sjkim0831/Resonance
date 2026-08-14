#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath, pathToFileURL } from "node:url";

const testRoot = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(process.env.RESONANCE_ROOT || path.join(testRoot, "../.."));
const frontendRoot = path.join(root, "projects/carbonet-frontend/source");
const shellPath = path.join(frontendRoot, "src/features/home-entry/GlobalUserGnbShell.tsx");
const pipelinePath = path.join(frontendRoot, "scripts/run-frontend-pipeline.mjs");
const shellSource = readFileSync(shellPath, "utf8");
const pipelineSource = readFileSync(pipelinePath, "utf8");

const memoBlock = `  const initialHomePayload = useMemo(
    () => ({ isLoggedIn: false, isEn: en, homeMenu: [] }),
    [en]
  );`;
const required = [
  ["memo hook import", shellSource, 'import { useEffect, useMemo, useState } from "react"'],
  ["locale-keyed stable initial payload", shellSource, memoBlock],
  ["stable initial value option", shellSource, "initialValue: initialHomePayload"],
  ["stable locale-correct fallback", shellSource, "const payload = home.value || initialHomePayload"],
  ["automatic frontend validation", pipelineSource, "ops/tests/test-global-user-gnb-home-fetch-stability.mjs"],
];

function violations(candidateShell = shellSource, candidatePipeline = pipelineSource) {
  const missing = required
    .filter(([, source, token]) => {
      const candidate = source === shellSource ? candidateShell : candidatePipeline;
      return !candidate.includes(token);
    })
    .map(([name]) => name);
  if (/initialValue:\s*\{\s*isLoggedIn:\s*false,\s*isEn:\s*en,\s*homeMenu:\s*\[\]\s*\}/s.test(candidateShell)) {
    missing.push("no fresh initial payload in render");
  }
  return missing;
}

assert.deepEqual(violations(), [], "global GNB home payload stability contract is incomplete");

const nodeModules = process.env.CARBONET_FRONTEND_NODE_MODULES
  ? path.resolve(process.env.CARBONET_FRONTEND_NODE_MODULES)
  : path.join(frontendRoot, "node_modules");
const ts = await import(pathToFileURL(path.join(nodeModules, "typescript/lib/typescript.js")).href);

function dependenciesEqual(left, right) {
  return Boolean(left && right)
    && left.length === right.length
    && left.every((value, index) => Object.is(value, right[index]));
}

function loadShellModule(candidateSource, initialEnglish = false) {
  const compiled = ts.transpileModule(candidateSource, {
    compilerOptions: {
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText;

  let english = initialEnglish;
  let hookCursor = 0;
  const hookSlots = [];
  let asyncSignature = null;
  let homeRequests = 0;
  const requestedPaths = [];
  const observedInitialValues = [];

  function beginRender() {
    hookCursor = 0;
  }

  const react = {
    useMemo(factory, dependencies) {
      const index = hookCursor++;
      const previous = hookSlots[index];
      if (!previous || !dependenciesEqual(previous.dependencies, dependencies)) {
        hookSlots[index] = { dependencies: [...dependencies], value: factory() };
      }
      return hookSlots[index].value;
    },
    useState(initialValue) {
      const index = hookCursor++;
      if (!hookSlots[index]) {
        hookSlots[index] = {
          value: typeof initialValue === "function" ? initialValue() : initialValue,
        };
      }
      return [hookSlots[index].value, (nextValue) => {
        hookSlots[index].value = typeof nextValue === "function"
          ? nextValue(hookSlots[index].value)
          : nextValue;
      }];
    },
    useEffect() {
      hookCursor += 1;
    },
  };
  const jsxRuntime = {
    Fragment: Symbol("Fragment"),
    jsx: (type, props, key) => ({ type, props, key }),
    jsxs: (type, props, key) => ({ type, props, key }),
  };
  const useAsyncValue = (load, dependencies, options) => {
    observedInitialValues.push(options.initialValue);
    const nextSignature = [options.initialValue, options.enabled ?? true, options.skipInitialLoad ?? false, ...dependencies];
    if (!dependenciesEqual(asyncSignature, nextSignature)) {
      asyncSignature = [...nextSignature];
      void load();
    }
    return {
      value: options.initialValue,
      loading: false,
      error: "",
      reload: load,
      setValue() {},
      setError() {},
    };
  };
  const fetchHomePayload = async () => {
    homeRequests += 1;
    requestedPaths.push(english ? "/en/api/home" : "/api/home");
    return { isLoggedIn: false, isEn: english, homeMenu: [] };
  };
  const content = {
    closeAllMenu: "Close",
    login: "Login",
    logout: "Logout",
    openAllMenu: "Open",
    signup: "Sign up",
  };
  const require = (specifier) => {
    if (specifier === "react") return react;
    if (specifier === "react/jsx-runtime") return jsxRuntime;
    if (specifier === "../../app/hooks/useAsyncValue") return { useAsyncValue };
    if (specifier === "../../app/hooks/useFrontendSession") {
      return { useFrontendSession: () => ({ logout: async () => undefined }) };
    }
    if (specifier === "../../lib/api/appBootstrap") return { fetchHomePayload };
    if (specifier === "../../lib/navigation/runtime") {
      return {
        buildLocalizedPath: (ko, en) => english ? en : ko,
        isEnglish: () => english,
        navigate() {},
      };
    }
    if (specifier === "./HomeEntrySections") {
      const Empty = () => null;
      return {
        HeaderBrand: Empty,
        HeaderDesktopNav: Empty,
        HeaderMobileMenu: Empty,
        HomeInlineStyles: Empty,
      };
    }
    if (specifier === "./homeEntryContent") {
      return { LOCALIZED_CONTENT: { en: content, ko: content } };
    }
    throw new Error(`Unexpected GlobalUserGnbShell dependency: ${specifier}`);
  };
  const module = { exports: {} };
  vm.runInNewContext(`(function (module, exports, require) { ${compiled}\n})(module, module.exports, require);`, {
    module,
    require,
  });

  return {
    render() {
      beginRender();
      return module.exports.GlobalUserGnbShell({ children: null });
    },
    setEnglish(value) {
      english = value;
    },
    get homeRequests() {
      return homeRequests;
    },
    get latestInitialValue() {
      return observedInitialValues.at(-1);
    },
    get requestedPaths() {
      return [...requestedPaths];
    },
  };
}

function renderWithThirtyRerenders(harness) {
  harness.render();
  for (let index = 0; index < 30; index += 1) harness.render();
}

const stable = loadShellModule(shellSource);
renderWithThirtyRerenders(stable);
assert.equal(stable.homeRequests, 1, "30 same-locale rerenders must issue /api/home exactly once");
assert.deepEqual(stable.requestedPaths, ["/api/home"], "Korean GNB must request the Korean home endpoint once");
assert.equal(stable.latestInitialValue.isEn, false, "Korean initial state must remain locale-correct");

stable.setEnglish(true);
renderWithThirtyRerenders(stable);
assert.equal(stable.homeRequests, 2, "one locale transition must add exactly one home request");
assert.deepEqual(stable.requestedPaths, ["/api/home", "/en/api/home"], "each locale must request its endpoint once");
assert.equal(stable.latestInitialValue.isEn, true, "English initial state must update with the locale");

const freshObjectMutant = shellSource.replace(
  memoBlock,
  "  const initialHomePayload = { isLoggedIn: false, isEn: en, homeMenu: [] };",
);
assert.notEqual(freshObjectMutant, shellSource, "fresh-object mutant was not created");
const fresh = loadShellModule(freshObjectMutant);
renderWithThirtyRerenders(fresh);
assert.equal(fresh.homeRequests, 31, "fresh-object mutant must reproduce one request per render");

const staleLocaleMutant = shellSource.replace("    [en]\n  );", "    []\n  );");
assert.notEqual(staleLocaleMutant, shellSource, "stale-locale mutant was not created");
const staleLocale = loadShellModule(staleLocaleMutant);
staleLocale.render();
staleLocale.setEnglish(true);
staleLocale.render();
assert.equal(staleLocale.latestInitialValue.isEn, false, "empty-dependency mutant must expose stale locale state");

let mutants = 2;
for (const [name, token] of required.map(([name, , token]) => [name, token])) {
  mutants += 1;
  const candidateShell = shellSource.includes(token) ? shellSource.replace(token, "__REMOVED_BY_MUTANT__") : shellSource;
  const candidatePipeline = pipelineSource.includes(token) ? pipelineSource.replace(token, "__REMOVED_BY_MUTANT__") : pipelineSource;
  assert(violations(candidateShell, candidatePipeline).includes(name), `${name} mutant survived`);
}

console.log(`GLOBAL_USER_GNB_HOME_FETCH_STABILITY_PASS rerenders=30 koFetch=1 enFetch=1 localeTransitions=1 freshObjectFetch=31 mutants=${mutants}`);
