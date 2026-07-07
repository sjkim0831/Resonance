import { useEffect, useMemo, useState } from "react";
import { AdminPageShell } from "../admin-entry/AdminPageShell";
import { buildLocalizedPath, isEnglish } from "../../lib/navigation/runtime";
import {
  fetchOllamaAgentProfiles,
  fetchOllamaAgentStageModelMatrix,
  fetchOllamaDeterministicRouteMap,
  fetchOllamaOperationReadiness,
  fetchOllamaRunnerProfiles,
  fetchOllamaRouterConfig,
  fetchOllamaToolchainProfiles,
  fetchPlatformInstallPage,
  dryRunOllamaOperation,
  previewOllamaOperation,
  verifyOllamaOperation,
  saveOllamaAgentProfiles,
  saveOllamaRunnerProfiles,
  saveOllamaToolchainProfiles,
  saveOllamaRouterConfig
} from "../../lib/api/platform";
import type {
  PlatformInstallPagePayload,
  PlatformOperationDryRunPayload,
  PlatformOperationPreviewPayload,
  PlatformOperationVerifyPayload
} from "../../lib/api/platformTypes";
import { stringOf } from "../admin-system/adminSystemShared";

const FALLBACK_PAYLOAD: PlatformInstallPagePayload = {
  summary: {
    platformName: "Resonance AI Runtime",
    projectName: "carbonet",
    runtimeMode: "shared-control-plane / isolated-project-runtime",
    installStatus: "documented",
    bundleMode: "air-gapped-bundle-ready"
  },
  installedModels: [
    { modelName: "qwen2.5-coder:3b", role: "classifier / verifier", status: "recommended" },
    { modelName: "gemma3:4b", role: "resolver / classifier fallback", status: "optional" },
    { modelName: "qwen2.5-coder:14b", role: "planner / implementer", status: "recommended" }
  ],
  runtimeProfiles: [
    { profileName: "control-plane", status: "required", description: "Ollama + worker + registry orchestration" },
    { profileName: "project-runtime", status: "required", description: "project-specific isolated runtime" },
    { profileName: "bundle-export", status: "required", description: "air-gapped export / import support" }
  ],
  runnerProfiles: [
    {
      runnerId: "ollama-local",
      runnerType: "ollama",
      mode: "primary",
      defaultModel: "qwen2.5-coder:14b",
      note: "Local bounded implementation and runtime operations"
    },
    {
      runnerId: "codex-cloud",
      runnerType: "codex",
      mode: "fallback",
      defaultModel: "codex",
      note: "Complex patch fallback and difficult refactor support"
    },
    {
      runnerId: "hermes-codex-cerebras",
      runnerType: "hermes",
      mode: "development",
      defaultModel: "cerebras-235b + codex",
      note: "Development agent orchestration and comparative workflow experiments"
    }
  ],
  bundleChecklist: [
    "Ollama install script",
    "model manifest",
    "project/common version set",
    "bundle export/import verification"
  ],
  recommendedActions: [
    "Install or verify Ollama",
    "Pull the recommended model set",
    "Verify runtime profile and bundle readiness",
    "Connect install page endpoints to live ops APIs"
  ],
  routerProfiles: [
    {
      routerId: "default-router",
      routingPolicy: "resolver-first",
      smallModel: "qwen2.5-coder:3b",
      mediumModel: "qwen2.5-coder:14b",
      note: "general Carbonet operations"
    }
  ],
  agentProfiles: [
    {
      profileId: "bounded-dev",
      responsibilities: "resolver/planner/implementer/verifier",
      maxFiles: "20",
      maxTotalLines: "2500"
    }
  ],
  toolchainProfiles: [
    {
      toolchainId: "ollama-runtime",
      toolchainType: "runtime",
      status: "active",
      note: "Production runtime with local Ollama model gateway and deterministic workers"
    },
    {
      toolchainId: "codex-sync",
      toolchainType: "cloud-dev",
      status: "optional",
      note: "Codex-assisted patch fallback, review support, and controlled implementation experiments"
    },
    {
      toolchainId: "hermes-codex-cerebras",
      toolchainType: "agent-lab",
      status: "optional",
      note: "Hermes development agent stack for routing, comparative evaluation, and Cerebras-backed experimentation"
    }
  ],
  commonJarSet: [
    {
      artifactId: "resonance-common-core",
      artifactVersion: "1.0.0-seed",
      role: "canonical common capability layer",
      updatePolicy: "adapter-compatible wave promotion"
    },
    {
      artifactId: "screenbuilder-core",
      artifactVersion: "1.0.0-seed",
      role: "screen builder engine",
      updatePolicy: "structure version gated"
    },
    {
      artifactId: "mapper-infra",
      artifactVersion: "1.0.0-seed",
      role: "shared mapper / persistence support candidate",
      updatePolicy: "wave-5 mirrored candidate"
    },
    {
      artifactId: "web-support",
      artifactVersion: "1.0.0-seed",
      role: "shared web support candidate",
      updatePolicy: "wave-5 mirrored candidate"
    }
  ],
  projectPackageSet: [
    {
      packageId: "carbonet-runtime",
      runtimeTarget: "isolated-project-runtime",
      includes: "project-runtime.jar + project-adapter.jar + common jar set + theme bundle + migration bundle"
    }
  ],
  k8sReleaseProfiles: [
    {
      releaseId: "operations-console",
      namespace: "resonance-system",
      workloadType: "deployment",
      deployMode: "shared-control-plane"
    },
    {
      releaseId: "carbonet-runtime",
      namespace: "project-carbonet",
      workloadType: "deployment",
      deployMode: "isolated-project-runtime"
    }
  ],
  builderStructure: {
    structureVersion: "screen-first-v1",
    currentScope: "screen / route / manifest / package composition",
    nextScope: "backend / db-aware scaffold",
    packageComposerEnabled: "true"
  },
  promotionWaveStatus: [
    {
      waveId: "wave-6-active",
      moduleId: "screenbuilder-core",
      workspace: "Resonance",
      status: "active-pom-replaced",
      note: "Active pom.xml replaced after rename-only diff review"
    },
    {
      waveId: "wave-3",
      moduleId: "resonance-modules-reactor",
      workspace: "Resonance",
      status: "seeded",
      note: "Transitional parent and workspace reactor established"
    },
    {
      waveId: "wave-4",
      moduleId: "screenbuilder-runtime-common-adapter",
      workspace: "Resonance",
      status: "child-pom-seeded",
      note: "Child pom transition draft prepared with screenbuilder-core bridge target"
    },
    {
      waveId: "wave-4",
      moduleId: "platform-version-control",
      workspace: "Resonance",
      status: "child-pom-seeded",
      note: "Child pom transition draft prepared"
    },
    {
      waveId: "wave-6-active",
      moduleId: "mapper-infra",
      workspace: "Resonance",
      status: "active-pom-replaced",
      note: "Active pom.xml replaced after Wave 5 seed comparison"
    },
    {
      waveId: "wave-6-active",
      moduleId: "web-support",
      workspace: "Resonance",
      status: "active-pom-replaced",
      note: "Active pom.xml replaced after Wave 5 seed comparison"
    },
    {
      waveId: "wave-5-bridge",
      moduleId: "platform-version-control",
      workspace: "Resonance",
      status: "bridge-seeded",
      note: "pom.wave5.bridge.seed.xml prepared with resonance-mapper-infra and resonance-web-support"
    }
  ],
  operationReadiness: [
    {
      operationId: "backup-create",
      status: "planned-live-check",
      scriptPath: "ops/scripts/assemble-project-release.sh",
      note: "Assemble project release and prepare rollback-safe backup snapshot"
    },
    {
      operationId: "bundle-export",
      status: "planned-live-check",
      scriptPath: "ops/scripts/assemble-project-release.sh",
      note: "Prepare air-gapped export bundle from project release and common package set"
    },
    {
      operationId: "docker-package-build",
      status: "planned-live-check",
      scriptPath: "ops/scripts/build-project-docker.sh",
      note: "Build project runtime Docker image from assembled release"
    },
    {
      operationId: "project-release-deploy",
      status: "planned-live-check",
      scriptPath: "ops/scripts/deploy-project-release.sh",
      note: "Remote release deployment with rollback fallback"
    },
    {
      operationId: "k8s-release",
      status: "planned-live-check",
      scriptPath: "/opt/Resonance/deploy/k8s/projects/carbonet/carbonet-runtime.deployment.yaml",
      note: "Project runtime Kubernetes deployment manifest"
    }
  ],
  message: "Backend install APIs are not wired yet, so this page currently shows the planned contract and readiness checklist."
};

function yesNoLabel(value: string, english: boolean) {
  if (!value) {
    return english ? "Unknown" : "미정";
  }
  const normalized = value.trim().toLowerCase();
  if (["y", "yes", "true", "ready", "installed", "running"].includes(normalized)) {
    return english ? "Ready" : "준비됨";
  }
  if (["n", "no", "false", "missing", "stopped"].includes(normalized)) {
    return english ? "Missing" : "미준비";
  }
  return value;
}

function prettyJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function parseJsonArray(value: string) {
  const parsed = JSON.parse(value);
  if (!Array.isArray(parsed)) {
    throw new Error("Expected a JSON array.");
  }
  return parsed as Array<Record<string, unknown>>;
}

export function PlatformInstallMigrationPage() {
  const english = isEnglish();
  const [payload, setPayload] = useState<PlatformInstallPagePayload>(FALLBACK_PAYLOAD);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [routerProfilesText, setRouterProfilesText] = useState(prettyJson(FALLBACK_PAYLOAD.routerProfiles || []));
  const [agentProfilesText, setAgentProfilesText] = useState(prettyJson(FALLBACK_PAYLOAD.agentProfiles || []));
  const [runnerProfilesText, setRunnerProfilesText] = useState(prettyJson(FALLBACK_PAYLOAD.runnerProfiles || []));
  const [toolchainProfilesText, setToolchainProfilesText] = useState(prettyJson(FALLBACK_PAYLOAD.toolchainProfiles || []));
  const [activeRouterId, setActiveRouterId] = useState("default-router");
  const [routingPolicy, setRoutingPolicy] = useState("resolver-first");
  const [defaultAgentProfileId, setDefaultAgentProfileId] = useState("bounded-dev");
  const [preferredRunnerId, setPreferredRunnerId] = useState("ollama-local");
  const [preferredToolchainId, setPreferredToolchainId] = useState("ollama-runtime");
  const [saveMessage, setSaveMessage] = useState("");
  const [saveError, setSaveError] = useState("");
  const [savingSection, setSavingSection] = useState<"" | "router" | "agent" | "runner" | "toolchain">("");
  const [operationPreview, setOperationPreview] = useState<PlatformOperationPreviewPayload | null>(null);
  const [operationVerify, setOperationVerify] = useState<PlatformOperationVerifyPayload | null>(null);
  const [operationDryRun, setOperationDryRun] = useState<PlatformOperationDryRunPayload | null>(null);
  const [previewLoadingId, setPreviewLoadingId] = useState("");
  const [verifyLoadingId, setVerifyLoadingId] = useState("");
  const [dryRunLoadingId, setDryRunLoadingId] = useState("");
  const [deterministicRouteMap, setDeterministicRouteMap] = useState<Record<string, unknown> | null>(null);
  const [agentStageModelMatrix, setAgentStageModelMatrix] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchPlatformInstallPage()
      .then((response) => {
        if (!active) {
          return;
        }
        setPayload({
          ...FALLBACK_PAYLOAD,
          ...response,
          summary: { ...(FALLBACK_PAYLOAD.summary || {}), ...(response.summary || {}) }
        });
        setRouterProfilesText(prettyJson(response.routerProfiles || FALLBACK_PAYLOAD.routerProfiles || []));
        setAgentProfilesText(prettyJson(response.agentProfiles || FALLBACK_PAYLOAD.agentProfiles || []));
        setRunnerProfilesText(prettyJson(response.runnerProfiles || FALLBACK_PAYLOAD.runnerProfiles || []));
        setToolchainProfilesText(prettyJson(response.toolchainProfiles || FALLBACK_PAYLOAD.toolchainProfiles || []));
        setActiveRouterId(stringOf(response.summary || {}, "activeRouterId") || "default-router");
        setDefaultAgentProfileId(stringOf(response.summary || {}, "defaultAgentProfileId") || "bounded-dev");
        setPreferredRunnerId(stringOf(response.summary || {}, "preferredRunnerId") || "ollama-local");
        setPreferredToolchainId(stringOf(response.summary || {}, "preferredToolchainId") || "ollama-runtime");
        setErrorMessage("");
      })
      .catch((error) => {
        if (!active) {
          return;
        }
        setPayload(FALLBACK_PAYLOAD);
        setErrorMessage(error instanceof Error ? error.message : String(error || ""));
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    fetchOllamaRouterConfig()
      .then((response) => {
        if (!active) {
          return;
        }
        if (Array.isArray(response.routerProfiles)) {
          setPayload((current) => ({ ...current, routerProfiles: response.routerProfiles as Array<Record<string, unknown>> }));
          setRouterProfilesText(prettyJson(response.routerProfiles));
        }
        setActiveRouterId(stringOf(response, "activeRouterId") || "default-router");
        setRoutingPolicy(stringOf(response, "routingPolicy") || "resolver-first");
      })
      .catch(() => undefined);

    fetchOllamaAgentProfiles()
      .then((response) => {
        if (!active) {
          return;
        }
        if (Array.isArray(response.agentProfiles)) {
          setPayload((current) => ({ ...current, agentProfiles: response.agentProfiles as Array<Record<string, unknown>> }));
          setAgentProfilesText(prettyJson(response.agentProfiles));
        }
        setDefaultAgentProfileId(stringOf(response, "defaultAgentProfileId") || "bounded-dev");
      })
      .catch(() => undefined);

    fetchOllamaRunnerProfiles()
      .then((response) => {
        if (!active) {
          return;
        }
        if (Array.isArray(response.runnerProfiles)) {
          setPayload((current) => ({ ...current, runnerProfiles: response.runnerProfiles as Array<Record<string, unknown>> }));
          setRunnerProfilesText(prettyJson(response.runnerProfiles));
        }
        setPreferredRunnerId(stringOf(response, "preferredRunnerId") || "ollama-local");
      })
      .catch(() => undefined);

    fetchOllamaToolchainProfiles()
      .then((response) => {
        if (!active) {
          return;
        }
        if (Array.isArray(response.toolchainProfiles)) {
          setPayload((current) => ({ ...current, toolchainProfiles: response.toolchainProfiles as Array<Record<string, unknown>> }));
          setToolchainProfilesText(prettyJson(response.toolchainProfiles));
        }
        setPreferredToolchainId(stringOf(response, "preferredToolchainId") || "ollama-runtime");
      })
      .catch(() => undefined);

    fetchOllamaOperationReadiness()
      .then((response) => {
        if (!active) {
          return;
        }
        if (Array.isArray(response.operationReadiness)) {
          setPayload((current) => ({ ...current, operationReadiness: response.operationReadiness as Array<Record<string, unknown>> }));
        }
      })
      .catch(() => undefined);

    fetchOllamaDeterministicRouteMap()
      .then((response) => {
        if (!active) {
          return;
        }
        setDeterministicRouteMap(response.routeMap && typeof response.routeMap === "object" ? response.routeMap as Record<string, unknown> : response);
      })
      .catch(() => undefined);

    fetchOllamaAgentStageModelMatrix()
      .then((response) => {
        if (!active) {
          return;
        }
        setAgentStageModelMatrix(response.stageModelMatrix && typeof response.stageModelMatrix === "object" ? response.stageModelMatrix as Record<string, unknown> : response);
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, []);

  const summaryRows = useMemo(() => {
    const summary = payload.summary || {};
    return [
      {
        label: english ? "Platform" : "플랫폼",
        value: stringOf(summary, "platformName") || "Resonance AI Runtime"
      },
      {
        label: english ? "Project" : "프로젝트",
        value: stringOf(summary, "projectName") || "carbonet"
      },
      {
        label: english ? "Runtime mode" : "런타임 모드",
        value: stringOf(summary, "runtimeMode") || "shared-control-plane / isolated-project-runtime"
      },
      {
        label: english ? "Install status" : "설치 상태",
        value: yesNoLabel(stringOf(summary, "installStatus"), english)
      },
      {
        label: english ? "Bundle mode" : "번들 모드",
        value: stringOf(summary, "bundleMode") || "air-gapped-bundle-ready"
      }
    ];
  }, [english, payload.summary]);

  async function handleSaveRouterProfiles() {
    setSavingSection("router");
    setSaveMessage("");
    setSaveError("");
    try {
      const routerProfiles = parseJsonArray(routerProfilesText);
      const response = await saveOllamaRouterConfig({
        routerProfiles,
        activeRouterId,
        routingPolicy
      });
      setPayload((current) => ({ ...current, routerProfiles }));
      setSaveMessage(stringOf(response, "message") || (english ? "Router profiles saved." : "라우터 프로필을 저장했습니다."));
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : String(error || ""));
    } finally {
      setSavingSection("");
    }
  }

  async function handleSaveAgentProfiles() {
    setSavingSection("agent");
    setSaveMessage("");
    setSaveError("");
    try {
      const agentProfiles = parseJsonArray(agentProfilesText);
      const response = await saveOllamaAgentProfiles({
        agentProfiles,
        defaultAgentProfileId
      });
      setPayload((current) => ({ ...current, agentProfiles }));
      setSaveMessage(stringOf(response, "message") || (english ? "Agent profiles saved." : "에이전트 프로필을 저장했습니다."));
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : String(error || ""));
    } finally {
      setSavingSection("");
    }
  }

  async function handleSaveRunnerProfiles() {
    setSavingSection("runner");
    setSaveMessage("");
    setSaveError("");
    try {
      const runnerProfiles = parseJsonArray(runnerProfilesText);
      const response = await saveOllamaRunnerProfiles({
        runnerProfiles,
        preferredRunnerId
      });
      setPayload((current) => ({ ...current, runnerProfiles }));
      setSaveMessage(stringOf(response, "message") || (english ? "Runner profiles saved." : "실행 러너 프로필을 저장했습니다."));
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : String(error || ""));
    } finally {
      setSavingSection("");
    }
  }

  async function handleSaveToolchainProfiles() {
    setSavingSection("toolchain");
    setSaveMessage("");
    setSaveError("");
    try {
      const toolchainProfiles = parseJsonArray(toolchainProfilesText);
      const response = await saveOllamaToolchainProfiles({
        toolchainProfiles,
        preferredToolchainId
      });
      setPayload((current) => ({ ...current, toolchainProfiles }));
      setSaveMessage(stringOf(response, "message") || (english ? "Toolchain profiles saved." : "도구체인 프로필을 저장했습니다."));
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : String(error || ""));
    } finally {
      setSavingSection("");
    }
  }

  async function handlePreviewOperation(operationId: string) {
    setPreviewLoadingId(operationId);
    setSaveError("");
    try {
      const response = await previewOllamaOperation(operationId);
      setOperationPreview(response);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : String(error || ""));
    } finally {
      setPreviewLoadingId("");
    }
  }

  async function handleVerifyOperation(operationId: string) {
    setVerifyLoadingId(operationId);
    setSaveError("");
    try {
      const response = await verifyOllamaOperation(operationId);
      setOperationVerify(response);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : String(error || ""));
    } finally {
      setVerifyLoadingId("");
    }
  }

  async function handleDryRunOperation(operationId: string) {
    setDryRunLoadingId(operationId);
    setSaveError("");
    try {
      const response = await dryRunOllamaOperation(operationId);
      setOperationDryRun(response);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : String(error || ""));
    } finally {
      setDryRunLoadingId("");
    }
  }

  return (
    <AdminPageShell
      title={english ? "AI Platform Install" : "AI 플랫폼 설치"}
      subtitle={
        english
          ? "Verify Ollama readiness, model catalog, runtime profile, and air-gapped bundle requirements."
          : "Ollama 준비 상태, 모델 카탈로그, 런타임 프로파일, air-gapped bundle 요구사항을 한 화면에서 확인합니다."
      }
      loading={loading}
      breadcrumbs={[
        { label: english ? "Admin" : "관리자", href: buildLocalizedPath("/admin/system/code", "/en/admin/system/code") },
        { label: english ? "System" : "시스템", href: buildLocalizedPath("/admin/system/code", "/en/admin/system/code") },
        { label: english ? "AI Platform Install" : "AI 플랫폼 설치" }
      ]}
      actions={
        <div className="flex flex-wrap gap-2">
          <a className="btn btn-primary" href={buildLocalizedPath("/admin/system/package-governance", "/en/admin/system/package-governance")}>
            {english ? "Open package governance" : "패키지 거버넌스 이동"}
          </a>
        </div>
      }
    >
      <div className="space-y-6">
        {errorMessage ? (
          <section className="gov-card border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            <strong>{english ? "Fallback mode" : "폴백 모드"}</strong>
            <p className="mt-2">
              {english
                ? "Live install APIs are not connected yet. The page is showing the planned contract baseline."
                : "실시간 설치 API가 아직 연결되지 않아, 계획된 계약 기준 화면을 표시하고 있습니다."}
            </p>
            <p className="mt-1 opacity-80">{errorMessage}</p>
          </section>
        ) : null}

        {saveMessage ? (
          <section className="gov-card border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900">
            {saveMessage}
          </section>
        ) : null}

        {saveError ? (
          <section className="gov-card border border-rose-300 bg-rose-50 p-4 text-sm text-rose-900">
            {saveError}
          </section>
        ) : null}

        <section className="gov-card p-5">
          <h2 className="text-lg font-semibold">{english ? "Platform summary" : "플랫폼 요약"}</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {summaryRows.map((row) => (
              <div key={row.label} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{row.label}</div>
                <div className="mt-2 text-sm font-semibold text-slate-900">{row.value}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <div className="gov-card p-5">
            <h2 className="text-lg font-semibold">{english ? "Recommended models" : "권장 모델 세트"}</h2>
            <div className="mt-4 space-y-3">
              {(payload.installedModels || []).map((item, index) => (
                <div key={`${stringOf(item, "modelName")}-${index}`} className="rounded-xl border border-slate-200 p-4">
                  <div className="text-sm font-semibold text-slate-900">{stringOf(item, "modelName")}</div>
                  <div className="mt-1 text-sm text-slate-600">{stringOf(item, "role")}</div>
                  <div className="mt-2 inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                    {yesNoLabel(stringOf(item, "status"), english)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="gov-card p-5">
            <h2 className="text-lg font-semibold">{english ? "Runtime profiles" : "런타임 프로파일"}</h2>
            <div className="mt-4 space-y-3">
              {(payload.runtimeProfiles || []).map((item, index) => (
                <div key={`${stringOf(item, "profileName")}-${index}`} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-slate-900">{stringOf(item, "profileName")}</div>
                    <span className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                      {yesNoLabel(stringOf(item, "status"), english)}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-slate-600">{stringOf(item, "description")}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="gov-card p-5">
          <h2 className="text-lg font-semibold">{english ? "Execution runners" : "실행 러너"}</h2>
          <div className="mt-4 grid gap-3 xl:grid-cols-3">
            {(payload.runnerProfiles || []).map((item: Record<string, unknown>, index: number) => (
              <div key={`${stringOf(item, "runnerId")}-${index}`} className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-slate-900">{stringOf(item, "runnerId")}</div>
                  <span className="inline-flex rounded-full bg-violet-50 px-3 py-1 text-xs font-medium text-violet-700">
                    {stringOf(item, "mode")}
                  </span>
                </div>
                <div className="mt-2 text-sm text-slate-600">{stringOf(item, "runnerType")}</div>
                <div className="mt-2 text-sm text-slate-700">
                  {english ? "Default model" : "기본 모델"}: {stringOf(item, "defaultModel")}
                </div>
                <p className="mt-2 text-sm text-slate-600">{stringOf(item, "note")}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="gov-card p-5">
          <h2 className="text-lg font-semibold">{english ? "Toolchain governance" : "도구체인 거버넌스"}</h2>
          <div className="mt-4 grid gap-3 xl:grid-cols-2">
            {(payload.toolchainProfiles || []).map((item: Record<string, unknown>, index: number) => (
              <div key={`${stringOf(item, "toolchainId")}-${index}`} className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-slate-900">{stringOf(item, "toolchainId")}</div>
                  <span className="inline-flex rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
                    {stringOf(item, "status")}
                  </span>
                </div>
                <div className="mt-2 text-sm text-slate-600">{stringOf(item, "toolchainType")}</div>
                <p className="mt-2 text-sm text-slate-600">{stringOf(item, "note")}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="gov-card overflow-hidden p-0">
          <div className="border-b border-slate-200 bg-slate-950 px-5 py-4 text-white">
            <div className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-200">3B deterministic control</div>
            <h2 className="mt-2 text-xl font-black">{english ? "Deterministic agent control" : "결정형 AI 에이전트 제어"}</h2>
            <p className="mt-2 max-w-4xl text-sm text-slate-300">
              {english
                ? "Small models should not search the whole repository. The route map and stage matrix bound what each agent may read, edit, and verify."
                : "소형 모델이 전체 저장소를 뒤지지 않도록 route-map과 stage matrix가 읽기, 수정, 검증 범위를 먼저 제한합니다."}
            </p>
          </div>
          <div className="grid gap-4 p-5 xl:grid-cols-2">
            <div className="rounded-2xl border border-cyan-100 bg-cyan-50/70 p-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-black text-slate-900">{english ? "Route map" : "라우트/파일 맵"}</h3>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-cyan-700">
                  {stringOf(deterministicRouteMap || {}, "canonicalRoot") || "/opt/Resonance"}
                </span>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                {Object.entries((deterministicRouteMap?.readBudgets || {}) as Record<string, unknown>).slice(0, 6).map(([key, value]) => (
                  <div key={key} className="rounded-xl bg-white p-3 shadow-sm">
                    <div className="text-[11px] font-semibold text-slate-500">{key}</div>
                    <div className="mt-1 text-lg font-black text-slate-950">{String(value)}</div>
                  </div>
                ))}
              </div>
              <div className="mt-4 space-y-2">
                {(((deterministicRouteMap?.zones || []) as Array<Record<string, unknown>>).slice(0, 4)).map((zone) => (
                  <div key={stringOf(zone, "name")} className="rounded-xl bg-white p-3 text-sm shadow-sm">
                    <div className="font-bold text-slate-900">{stringOf(zone, "name")}</div>
                    <div className="mt-1 text-slate-600">{stringOf(zone, "metaphor")}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-amber-100 bg-amber-50/80 p-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-black text-slate-900">{english ? "Stage model matrix" : "단계별 모델 매트릭스"}</h3>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-amber-700">
                  {stringOf(((agentStageModelMatrix?.models || {}) as Record<string, unknown>), "smallLocalDefault") || "3B bounded"}
                </span>
              </div>
              <div className="mt-4 space-y-2">
                {(((agentStageModelMatrix?.stages || []) as Array<Record<string, unknown>>).slice(0, 8)).map((stage) => (
                  <div key={stringOf(stage, "stage")} className="rounded-xl bg-white p-3 shadow-sm">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-bold text-slate-900">{stringOf(stage, "stage")}</div>
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-600">{stringOf(stage, "model")}</span>
                    </div>
                    <div className="mt-1 text-xs text-slate-600">{stringOf(stage, "output")}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <div className="gov-card p-5">
            <h2 className="text-lg font-semibold">{english ? "Ollama router profiles" : "Ollama 라우터 프로필"}</h2>
            <div className="mt-4 space-y-3">
              {(payload.routerProfiles || []).map((item, index) => (
                <div key={`${stringOf(item, "routerId")}-${index}`} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-slate-900">{stringOf(item, "routerId")}</div>
                    <span className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
                      {stringOf(item, "routingPolicy")}
                    </span>
                  </div>
                  <div className="mt-3 grid gap-2 text-sm text-slate-600 md:grid-cols-2">
                    <div>{english ? "Small model" : "소형 모델"}: {stringOf(item, "smallModel")}</div>
                    <div>{english ? "Medium model" : "중형 모델"}: {stringOf(item, "mediumModel")}</div>
                  </div>
                  <p className="mt-2 text-sm text-slate-600">{stringOf(item, "note")}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="gov-card p-5">
            <h2 className="text-lg font-semibold">{english ? "AI agent profiles" : "AI 에이전트 프로필"}</h2>
            <div className="mt-4 space-y-3">
              {(payload.agentProfiles || []).map((item, index) => (
                <div key={`${stringOf(item, "profileId")}-${index}`} className="rounded-xl border border-slate-200 p-4">
                  <div className="text-sm font-semibold text-slate-900">{stringOf(item, "profileId")}</div>
                  <p className="mt-2 text-sm text-slate-600">{stringOf(item, "responsibilities")}</p>
                  <div className="mt-3 grid gap-2 text-sm text-slate-600 md:grid-cols-2">
                    <div>{english ? "Max files" : "최대 파일 수"}: {stringOf(item, "maxFiles")}</div>
                    <div>{english ? "Max total lines" : "최대 라인 수"}: {stringOf(item, "maxTotalLines")}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <div className="gov-card p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">{english ? "Edit runner profiles" : "실행 러너 편집"}</h2>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSaveRunnerProfiles}
                disabled={savingSection === "runner"}
              >
                {savingSection === "runner"
                  ? (english ? "Saving..." : "저장 중...")
                  : (english ? "Save runner profiles" : "실행 러너 저장")}
              </button>
            </div>
            <div className="mt-4 space-y-4">
              <label className="flex flex-col gap-2">
                <span className="text-sm font-semibold text-slate-700">{english ? "Preferred runner id" : "기본 실행 러너 ID"}</span>
                <input
                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  value={preferredRunnerId}
                  onChange={(event) => setPreferredRunnerId(event.target.value)}
                />
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-sm font-semibold text-slate-700">{english ? "Runner profiles JSON" : "실행 러너 JSON"}</span>
                <textarea
                  className="min-h-[260px] rounded-2xl border border-slate-300 px-4 py-3 font-mono text-xs"
                  value={runnerProfilesText}
                  onChange={(event) => setRunnerProfilesText(event.target.value)}
                />
              </label>
            </div>
          </div>

          <div className="gov-card p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">{english ? "Edit toolchain profiles" : "도구체인 편집"}</h2>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSaveToolchainProfiles}
                disabled={savingSection === "toolchain"}
              >
                {savingSection === "toolchain"
                  ? (english ? "Saving..." : "저장 중...")
                  : (english ? "Save toolchains" : "도구체인 저장")}
              </button>
            </div>
            <div className="mt-4 space-y-4">
              <label className="flex flex-col gap-2">
                <span className="text-sm font-semibold text-slate-700">{english ? "Preferred toolchain id" : "기본 도구체인 ID"}</span>
                <input
                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  value={preferredToolchainId}
                  onChange={(event) => setPreferredToolchainId(event.target.value)}
                />
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-sm font-semibold text-slate-700">{english ? "Toolchain profiles JSON" : "도구체인 JSON"}</span>
                <textarea
                  className="min-h-[260px] rounded-2xl border border-slate-300 px-4 py-3 font-mono text-xs"
                  value={toolchainProfilesText}
                  onChange={(event) => setToolchainProfilesText(event.target.value)}
                />
              </label>
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <div className="gov-card p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">{english ? "Edit router config" : "라우터 설정 편집"}</h2>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSaveRouterProfiles}
                disabled={savingSection === "router"}
              >
                {savingSection === "router"
                  ? (english ? "Saving..." : "저장 중...")
                  : (english ? "Save router config" : "라우터 설정 저장")}
              </button>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-2">
                <span className="text-sm font-semibold text-slate-700">{english ? "Active router id" : "활성 라우터 ID"}</span>
                <input
                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  value={activeRouterId}
                  onChange={(event) => setActiveRouterId(event.target.value)}
                />
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-sm font-semibold text-slate-700">{english ? "Routing policy" : "라우팅 정책"}</span>
                <input
                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                  value={routingPolicy}
                  onChange={(event) => setRoutingPolicy(event.target.value)}
                />
              </label>
            </div>
            <label className="mt-4 flex flex-col gap-2">
              <span className="text-sm font-semibold text-slate-700">{english ? "Router profiles JSON" : "라우터 프로필 JSON"}</span>
              <textarea
                className="min-h-[320px] rounded-xl border border-slate-300 p-3 font-mono text-xs"
                value={routerProfilesText}
                onChange={(event) => setRouterProfilesText(event.target.value)}
                spellCheck={false}
              />
            </label>
          </div>

          <div className="gov-card p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">{english ? "Edit agent profiles" : "에이전트 프로필 편집"}</h2>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSaveAgentProfiles}
                disabled={savingSection === "agent"}
              >
                {savingSection === "agent"
                  ? (english ? "Saving..." : "저장 중...")
                  : (english ? "Save agent profiles" : "에이전트 프로필 저장")}
              </button>
            </div>
            <label className="mt-4 flex flex-col gap-2">
              <span className="text-sm font-semibold text-slate-700">{english ? "Default agent profile id" : "기본 에이전트 프로필 ID"}</span>
              <input
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                value={defaultAgentProfileId}
                onChange={(event) => setDefaultAgentProfileId(event.target.value)}
              />
            </label>
            <label className="mt-4 flex flex-col gap-2">
              <span className="text-sm font-semibold text-slate-700">{english ? "Agent profiles JSON" : "에이전트 프로필 JSON"}</span>
              <textarea
                className="min-h-[320px] rounded-xl border border-slate-300 p-3 font-mono text-xs"
                value={agentProfilesText}
                onChange={(event) => setAgentProfilesText(event.target.value)}
                spellCheck={false}
              />
            </label>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <div className="gov-card p-5">
            <h2 className="text-lg font-semibold">{english ? "Common JAR set" : "공통 JAR 세트"}</h2>
            <div className="mt-4 space-y-3">
              {(payload.commonJarSet || []).map((item: Record<string, unknown>, index: number) => (
                <div key={`${stringOf(item, "artifactId")}-${index}`} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-slate-900">{stringOf(item, "artifactId")}</div>
                    <span className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                      {stringOf(item, "artifactVersion")}
                    </span>
                  </div>
                  <div className="mt-2 text-sm text-slate-600">{stringOf(item, "role")}</div>
                  <p className="mt-2 text-sm text-slate-600">{stringOf(item, "updatePolicy")}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="gov-card p-5">
            <h2 className="text-lg font-semibold">{english ? "Project package set" : "프로젝트 패키지 세트"}</h2>
            <div className="mt-4 space-y-3">
              {(payload.projectPackageSet || []).map((item: Record<string, unknown>, index: number) => (
                <div key={`${stringOf(item, "packageId")}-${index}`} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-slate-900">{stringOf(item, "packageId")}</div>
                    <span className="inline-flex rounded-full bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700">
                      {stringOf(item, "runtimeTarget")}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-slate-600">{stringOf(item, "includes")}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <div className="gov-card p-5">
            <h2 className="text-lg font-semibold">{english ? "Kubernetes release profiles" : "Kubernetes 릴리스 프로필"}</h2>
            <div className="mt-4 space-y-3">
              {(payload.k8sReleaseProfiles || []).map((item: Record<string, unknown>, index: number) => (
                <div key={`${stringOf(item, "releaseId")}-${index}`} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-slate-900">{stringOf(item, "releaseId")}</div>
                    <span className="inline-flex rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">
                      {stringOf(item, "namespace")}
                    </span>
                  </div>
                  <div className="mt-3 grid gap-2 text-sm text-slate-600 md:grid-cols-2">
                    <div>{english ? "Workload" : "워크로드"}: {stringOf(item, "workloadType")}</div>
                    <div>{english ? "Deploy mode" : "배포 모드"}: {stringOf(item, "deployMode")}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="gov-card p-5">
            <h2 className="text-lg font-semibold">{english ? "Builder structure" : "빌더 구조"}</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{english ? "Structure version" : "구조 버전"}</div>
                <div className="mt-2 text-sm font-semibold text-slate-900">{stringOf(payload.builderStructure || {}, "structureVersion")}</div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{english ? "Package composer" : "패키지 조립기"}</div>
                <div className="mt-2 text-sm font-semibold text-slate-900">
                  {yesNoLabel(stringOf(payload.builderStructure || {}, "packageComposerEnabled"), english)}
                </div>
              </div>
            </div>
            <div className="mt-4 space-y-3 text-sm text-slate-700">
              <p><strong>{english ? "Current scope" : "현재 범위"}:</strong> {stringOf(payload.builderStructure || {}, "currentScope")}</p>
              <p><strong>{english ? "Next scope" : "다음 범위"}:</strong> {stringOf(payload.builderStructure || {}, "nextScope")}</p>
            </div>
          </div>

          <div className="gov-card p-5">
            <h2 className="text-lg font-semibold">{english ? "Resonance promotion waves" : "Resonance 승격 웨이브"}</h2>
            <div className="mt-4 space-y-3">
              {(payload.promotionWaveStatus || []).map((item: Record<string, unknown>, index: number) => (
                <div key={`${stringOf(item, "waveId")}-${stringOf(item, "moduleId")}-${index}`} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-slate-900">{stringOf(item, "moduleId")}</div>
                    <span className="inline-flex rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
                      {stringOf(item, "waveId")}
                    </span>
                  </div>
                  <div className="mt-3 grid gap-2 text-sm text-slate-600 md:grid-cols-2">
                    <div>{english ? "Workspace" : "워크스페이스"}: {stringOf(item, "workspace")}</div>
                    <div>{english ? "Status" : "상태"}: {stringOf(item, "status")}</div>
                  </div>
                  <p className="mt-2 text-sm text-slate-600">{stringOf(item, "note")}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="gov-card p-5">
          <h2 className="text-lg font-semibold">{english ? "Operation readiness" : "운영 작업 준비도"}</h2>
          <div className="mt-4 grid gap-3 xl:grid-cols-2">
            {(payload.operationReadiness || []).map((item: Record<string, unknown>, index: number) => (
              <div key={`${stringOf(item, "operationId")}-${index}`} className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-slate-900">{stringOf(item, "operationId")}</div>
                  <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                    {stringOf(item, "status")}
                  </span>
                </div>
                <p className="mt-2 break-all font-mono text-xs text-slate-500">{stringOf(item, "scriptPath")}</p>
                <p className="mt-2 text-sm text-slate-600">{stringOf(item, "note")}</p>
                <div className="mt-3 grid gap-2 text-sm text-slate-600 md:grid-cols-2">
                  <div>{english ? "File ready" : "파일 준비"}: {yesNoLabel(stringOf(item, "fileReadyYn"), english)}</div>
                  <div>{english ? "Command ready" : "명령 준비"}: {yesNoLabel(stringOf(item, "commandReadyYn"), english)}</div>
                </div>
                <div className="mt-4">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => handlePreviewOperation(stringOf(item, "operationId"))}
                      disabled={previewLoadingId === stringOf(item, "operationId")}
                    >
                      {previewLoadingId === stringOf(item, "operationId")
                        ? (english ? "Loading preview..." : "미리보기 불러오는 중...")
                        : (english ? "Preview script" : "스크립트 미리보기")}
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => handleVerifyOperation(stringOf(item, "operationId"))}
                      disabled={verifyLoadingId === stringOf(item, "operationId")}
                    >
                      {verifyLoadingId === stringOf(item, "operationId")
                        ? (english ? "Verifying..." : "검증 중...")
                        : (english ? "Run dry-run verify" : "드라이런 검증")}
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => handleDryRunOperation(stringOf(item, "operationId"))}
                      disabled={dryRunLoadingId === stringOf(item, "operationId")}
                    >
                      {dryRunLoadingId === stringOf(item, "operationId")
                        ? (english ? "Planning..." : "계획 생성 중...")
                        : (english ? "Show dry-run plan" : "드라이런 계획 보기")}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {operationPreview ? (
          <section className="gov-card p-5">
            <h2 className="text-lg font-semibold">{english ? "Operation preview" : "운영 작업 미리보기"}</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{english ? "Operation" : "작업"}</div>
                <div className="mt-2 text-sm font-semibold text-slate-900">{stringOf(operationPreview, "operationId")}</div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{english ? "Status" : "상태"}</div>
                <div className="mt-2 text-sm font-semibold text-slate-900">{stringOf(operationPreview, "status")}</div>
              </div>
            </div>
            <p className="mt-4 break-all font-mono text-xs text-slate-500">{stringOf(operationPreview, "scriptPath")}</p>
            <p className="mt-2 text-sm text-slate-700">{stringOf(operationPreview, "note")}</p>
            <pre className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-slate-950 p-4 text-xs text-slate-100">{Array.isArray(operationPreview.previewLines) ? operationPreview.previewLines.join("\n") : ""}</pre>
          </section>
        ) : null}

        {operationVerify ? (
          <section className="gov-card p-5">
            <h2 className="text-lg font-semibold">{english ? "Operation verify result" : "운영 작업 검증 결과"}</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{english ? "Operation" : "작업"}</div>
                <div className="mt-2 text-sm font-semibold text-slate-900">{stringOf(operationVerify, "operationId")}</div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{english ? "Status" : "상태"}</div>
                <div className="mt-2 text-sm font-semibold text-slate-900">{stringOf(operationVerify, "status")}</div>
              </div>
            </div>
            <p className="mt-4 text-sm text-slate-700">{stringOf(operationVerify, "summaryMessage")}</p>
            <div className="mt-4 space-y-3">
              {(operationVerify.checks || []).map((item: Record<string, unknown>, index: number) => (
                <div key={`${stringOf(item, "checkId")}-${index}`} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-slate-900">{stringOf(item, "checkId")}</div>
                    <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                      {stringOf(item, "result")}
                    </span>
                  </div>
                  <p className="mt-2 break-all text-sm text-slate-600">{stringOf(item, "target")}</p>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {operationDryRun ? (
          <section className="gov-card p-5">
            <h2 className="text-lg font-semibold">{english ? "Operation dry-run plan" : "운영 작업 드라이런 계획"}</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{english ? "Operation" : "작업"}</div>
                <div className="mt-2 text-sm font-semibold text-slate-900">{stringOf(operationDryRun, "operationId")}</div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{english ? "Status" : "상태"}</div>
                <div className="mt-2 text-sm font-semibold text-slate-900">{stringOf(operationDryRun, "status")}</div>
              </div>
            </div>
            <p className="mt-4 text-sm text-slate-700">{stringOf(operationDryRun, "summaryMessage")}</p>
            <div className="mt-4 grid gap-6 xl:grid-cols-2">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">{english ? "Resolved inputs" : "해결된 입력"}</h3>
                <div className="mt-3 space-y-3">
                  {(operationDryRun.resolvedInputs || []).map((item: Record<string, unknown>, index: number) => (
                    <div key={`${stringOf(item, "name")}-${index}`} className="rounded-xl border border-slate-200 p-4">
                      <div className="text-sm font-semibold text-slate-900">{stringOf(item, "name")}</div>
                      <p className="mt-2 break-all text-sm text-slate-600">{stringOf(item, "value")}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900">{english ? "Planned steps" : "계획 단계"}</h3>
                <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-slate-700">
                  {(operationDryRun.plannedSteps || []).map((item, index) => (
                    <li key={`${item}-${index}`}>{item}</li>
                  ))}
                </ol>
              </div>
            </div>
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-slate-900">{english ? "Command preview" : "명령 미리보기"}</h3>
              <pre className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-slate-950 p-4 text-xs text-slate-100">{Array.isArray(operationDryRun.commandPreview) ? operationDryRun.commandPreview.join("\n") : ""}</pre>
            </div>
          </section>
        ) : null}

        <section className="grid gap-6 xl:grid-cols-2">
          <div className="gov-card p-5">
            <h2 className="text-lg font-semibold">{english ? "Air-gapped bundle checklist" : "Air-gapped 번들 체크리스트"}</h2>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-slate-700">
              {(payload.bundleChecklist || []).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>

          <div className="gov-card p-5">
            <h2 className="text-lg font-semibold">{english ? "Recommended next actions" : "권장 다음 작업"}</h2>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-slate-700">
              {(payload.recommendedActions || []).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </section>

        <section className="gov-card p-5">
          <h2 className="text-lg font-semibold">{english ? "Integration note" : "연동 메모"}</h2>
          <p className="mt-3 text-sm leading-6 text-slate-700">
            {payload.message || FALLBACK_PAYLOAD.message}
          </p>
          <p className="mt-3 text-xs text-slate-500">
            {english ? "Pattern reference manifest" : "패턴 참조 매니페스트"}:{" "}
            {stringOf(payload, "patternReferenceManifestPath") || "data/ai-runtime/pattern-reference-manifest.json"}
          </p>
        </section>
      </div>
    </AdminPageShell>
  );
}

export default PlatformInstallMigrationPage;
