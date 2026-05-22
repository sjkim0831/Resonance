import { type CSSProperties, useMemo, useState } from "react";
import { logGovernanceScope } from "../../app/policy/debug";
import { buildLocalizedPath, isEnglish } from "../../lib/navigation/runtime";
import { AdminPageShell } from "../admin-entry/AdminPageShell";
import { GridToolbar, PageStatusNotice, SummaryMetricCard } from "../admin-ui/common";
import { AdminWorkspacePageFrame } from "../admin-ui/pageFrames";
import { BuilderGovernanceNav } from "./BuilderGovernanceNav";

type PageKind = "theme" | "css" | "patterns" | "agents";

type Row = {
  name: string;
  lane: string;
  status: string;
  owner: string;
  output: string;
};

type ThemeToken = {
  key: string;
  labelKo: string;
  labelEn: string;
  value: string;
  type: "color" | "size" | "density";
};

type Preset = {
  id: string;
  labelKo: string;
  labelEn: string;
  layer: string;
  binding: string;
};

const DEFAULT_THEME_TOKENS: ThemeToken[] = [
  { key: "primary", labelKo: "주 색상", labelEn: "Primary", value: "#00378b", type: "color" },
  { key: "accent", labelKo: "강조 색상", labelEn: "Accent", value: "#0f766e", type: "color" },
  { key: "warning", labelKo: "주의 색상", labelEn: "Warning", value: "#b45309", type: "color" },
  { key: "surface", labelKo: "표면 색상", labelEn: "Surface", value: "#f8fbff", type: "color" },
  { key: "radius", labelKo: "모서리", labelEn: "Radius", value: "8px", type: "size" },
  { key: "density", labelKo: "밀도", labelEn: "Density", value: "compact", type: "density" }
];

const COMPONENT_PRESETS: Preset[] = [
  { id: "button", labelKo: "버튼", labelEn: "Button", layer: "primitive", binding: "GovButton" },
  { id: "field", labelKo: "입력 필드", labelEn: "Field", layer: "primitive", binding: "FormField" },
  { id: "table", labelKo: "테이블", labelEn: "Table", layer: "primitive", binding: "AdminTable" },
  { id: "badge", labelKo: "배지", labelEn: "Badge", layer: "primitive", binding: "StatusBadge" },
  { id: "card", labelKo: "패널", labelEn: "Panel", layer: "layout", binding: "GovCard" },
  { id: "tabs", labelKo: "탭", labelEn: "Tabs", layer: "navigation", binding: "GovTabs" }
];

const TEMPLATE_PRESETS: Preset[] = [
  { id: "list", labelKo: "목록형", labelEn: "List", layer: "template", binding: "ScreenTemplateList" },
  { id: "detail", labelKo: "상세형", labelEn: "Detail", layer: "template", binding: "ScreenTemplateDetail" },
  { id: "edit", labelKo: "편집형", labelEn: "Edit", layer: "template", binding: "ScreenTemplateEdit" },
  { id: "review", labelKo: "검증형", labelEn: "Review", layer: "template", binding: "ScreenTemplateReview" }
];

const THEME_COMPONENT_ROWS: Row[] = [
  { name: "GovButton", lane: "primitive", status: "ACTIVE", owner: "common", output: "button variants" },
  { name: "AdminTable", lane: "primitive", status: "ACTIVE", owner: "common", output: "dense table" },
  { name: "FormField", lane: "theme", status: "READY", owner: "theme", output: "label/control/error" },
  { name: "ScreenTemplateList", lane: "template", status: "READY", owner: "builder", output: "list page preset" },
  { name: "ScreenTemplateDetail", lane: "template", status: "READY", owner: "builder", output: "detail page preset" }
];

const CSS_ROWS: Row[] = [
  { name: "--kr-gov-blue", lane: "token", status: "ACTIVE", owner: "admin", output: "primary color" },
  { name: "--kr-gov-radius", lane: "token", status: "ACTIVE", owner: "admin", output: "8px component radius" },
  { name: ".gov-card", lane: "utility", status: "ACTIVE", owner: "common", output: "panel surface" },
  { name: ".gov-btn", lane: "utility", status: "ACTIVE", owner: "common", output: "button system" },
  { name: ".data-table", lane: "utility", status: "READY", owner: "builder", output: "builder table surface" }
];

const PATTERN_ROWS: Row[] = [
  { name: "BUILD_RESTART_18000", lane: "deploy", status: "ACTIVE", owner: "carbonet-fast-bootstrap-ops", output: "build restart freshness" },
  { name: "BUILD_REDEPLOY_80", lane: "deploy", status: "READY", owner: "runtime-topology", output: "port 80 redeploy proof" },
  { name: "ADMIN_REACT_PAGE_CHANGE", lane: "frontend", status: "ACTIVE", owner: "admin-screen-unifier", output: "admin page patch" },
  { name: "BACKEND_CONTROLLER_SERVICE_API_CHANGE", lane: "backend", status: "ACTIVE", owner: "feature-builder", output: "controller service API" },
  { name: "DB_SCHEMA_PATCH_CHANGE", lane: "database", status: "ACTIVE", owner: "audit-trace", output: "CUBRID schema seed" },
  { name: "FULLSTACK_ADMIN_DB_API_CHANGE", lane: "fullstack", status: "ACTIVE", owner: "feature-builder", output: "screen API DB chain" },
  { name: "HERMES_PATTERN_REGISTRY_CHANGE", lane: "ai", status: "ACTIVE", owner: "orchestrator", output: "resolver guided steps" }
];

const AGENT_ROWS: Row[] = [
  { name: "Front Design 40B", lane: "stitch", status: "READY", owner: "design-ai", output: "theme + component screen" },
  { name: "DB Model", lane: "database", status: "READY", owner: "db-ai", output: "SQL + migration evidence" },
  { name: "Backend Model", lane: "spring", status: "READY", owner: "backend-ai", output: "Java service flow" },
  { name: "JavaScript Model", lane: "react", status: "READY", owner: "frontend-ai", output: "React interaction" },
  { name: "Operations Model", lane: "runtime", status: "READY", owner: "ops-ai", output: "build deploy runbook" },
  { name: "Management Model", lane: "governance", status: "READY", owner: "admin-ai", output: "scope audit authority" },
  { name: "Common / Project Model", lane: "adapter", status: "READY", owner: "platform-ai", output: "common core + project binding" }
];

const KIND_META: Record<PageKind, { id: string; titleKo: string; titleEn: string; icon: string; rows: Row[] }> = {
  theme: {
    id: "theme-management",
    titleKo: "테마 관리",
    titleEn: "Theme Management",
    icon: "palette",
    rows: THEME_COMPONENT_ROWS
  },
  css: {
    id: "css-management",
    titleKo: "CSS 관리",
    titleEn: "CSS Management",
    icon: "css",
    rows: CSS_ROWS
  },
  patterns: {
    id: "development-pattern-management",
    titleKo: "개발 패턴 관리",
    titleEn: "Development Pattern Management",
    icon: "schema",
    rows: PATTERN_ROWS
  },
  agents: {
    id: "ai-developer-team",
    titleKo: "AI 개발팀",
    titleEn: "AI Developer Team",
    icon: "groups",
    rows: AGENT_ROWS
  }
};

function statusClassName(status: string) {
  if (status === "ACTIVE") return "bg-emerald-100 text-emerald-700";
  if (status === "READY") return "bg-blue-100 text-[var(--kr-gov-blue)]";
  return "bg-amber-100 text-amber-700";
}

function GovernanceTable({ rows, en }: { rows: ReadonlyArray<Row>; en: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="data-table min-w-[860px]">
        <thead>
          <tr>
            <th>{en ? "Name" : "이름"}</th>
            <th>{en ? "Lane" : "레인"}</th>
            <th>{en ? "Owner" : "소유"}</th>
            <th>{en ? "Output" : "산출"}</th>
            <th>{en ? "Status" : "상태"}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.lane}-${row.name}`}>
              <td className="font-black">{row.name}</td>
              <td>{row.lane}</td>
              <td>{row.owner}</td>
              <td>{row.output}</td>
              <td>
                <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-black ${statusClassName(row.status)}`}>
                  {row.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function buildThemePayload(tokens: ThemeToken[], selectedComponent: string, selectedTemplate: string) {
  return {
    themeId: "admin-builder-default",
    installScope: "COMMON_DEF_PROJECT_BIND",
    tokens: Object.fromEntries(tokens.map((token) => [token.key, token.value])),
    componentPreset: selectedComponent,
    templatePreset: selectedTemplate,
    componentLibrary: COMPONENT_PRESETS.map((preset) => preset.binding),
    templateLibrary: TEMPLATE_PRESETS.map((preset) => preset.binding)
  };
}

function ThemeBuilderPanel({ en }: { en: boolean }) {
  const [tokens, setTokens] = useState<ThemeToken[]>(DEFAULT_THEME_TOKENS);
  const [selectedComponent, setSelectedComponent] = useState(COMPONENT_PRESETS[0].id);
  const [selectedTemplate, setSelectedTemplate] = useState(TEMPLATE_PRESETS[0].id);
  const [copied, setCopied] = useState(false);
  const tokenMap = Object.fromEntries(tokens.map((token) => [token.key, token.value]));
  const payload = useMemo(() => buildThemePayload(tokens, selectedComponent, selectedTemplate), [selectedComponent, selectedTemplate, tokens]);
  const payloadText = JSON.stringify(payload, null, 2);
  const selectedComponentPreset = COMPONENT_PRESETS.find((preset) => preset.id === selectedComponent) || COMPONENT_PRESETS[0];
  const selectedTemplatePreset = TEMPLATE_PRESETS.find((preset) => preset.id === selectedTemplate) || TEMPLATE_PRESETS[0];
  const previewStyle = {
    "--builder-primary": tokenMap.primary,
    "--builder-accent": tokenMap.accent,
    "--builder-warning": tokenMap.warning,
    "--builder-surface": tokenMap.surface,
    "--builder-radius": tokenMap.radius
  } as CSSProperties;

  function updateToken(key: string, value: string) {
    setTokens((current) => current.map((token) => token.key === key ? { ...token, value } : token));
  }

  async function copyPayload() {
    setCopied(false);
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(payloadText);
      setCopied(true);
    }
  }

  return (
    <>
      {copied ? <PageStatusNotice tone="success">{en ? "Theme payload copied." : "테마 payload를 복사했습니다."}</PageStatusNotice> : null}
      <section className="grid grid-cols-1 gap-3 xl:grid-cols-4">
        <SummaryMetricCard title={en ? "Tokens" : "토큰"} value={tokens.length} />
        <SummaryMetricCard title={en ? "Components" : "컴포넌트"} value={COMPONENT_PRESETS.length} />
        <SummaryMetricCard title={en ? "Templates" : "템플릿"} value={TEMPLATE_PRESETS.length} />
        <SummaryMetricCard title={en ? "Scope" : "스코프"} value="COMMON_DEF_PROJECT_BIND" />
      </section>

      <section className="grid gap-6 xl:grid-cols-[22rem_1fr]">
        <div className="space-y-6">
          <section className="gov-card">
            <GridToolbar title={en ? "Theme tokens" : "테마 토큰"} />
            <div className="space-y-4 p-6">
              {tokens.map((token) => (
                <label className="block" key={token.key}>
                  <span className="gov-label">{en ? token.labelEn : token.labelKo}</span>
                  <div className="flex items-center gap-2">
                    {token.type === "color" ? (
                      <input
                        aria-label={en ? token.labelEn : token.labelKo}
                        className="h-10 w-12 rounded border border-[var(--kr-gov-border-light)] bg-white p-1"
                        onChange={(event) => updateToken(token.key, event.target.value)}
                        type="color"
                        value={token.value}
                      />
                    ) : null}
                    {token.type === "density" ? (
                      <select className="gov-select" onChange={(event) => updateToken(token.key, event.target.value)} value={token.value}>
                        <option value="compact">compact</option>
                        <option value="comfortable">comfortable</option>
                        <option value="spacious">spacious</option>
                      </select>
                    ) : (
                      <input className="gov-input" onChange={(event) => updateToken(token.key, event.target.value)} value={token.value} />
                    )}
                  </div>
                </label>
              ))}
            </div>
          </section>

          <section className="gov-card">
            <GridToolbar title={en ? "Preset binding" : "프리셋 바인딩"} />
            <div className="space-y-4 p-6">
              <label className="block">
                <span className="gov-label">{en ? "Component preset" : "컴포넌트 프리셋"}</span>
                <select className="gov-select" onChange={(event) => setSelectedComponent(event.target.value)} value={selectedComponent}>
                  {COMPONENT_PRESETS.map((preset) => <option key={preset.id} value={preset.id}>{en ? preset.labelEn : preset.labelKo}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="gov-label">{en ? "Template preset" : "템플릿 프리셋"}</span>
                <select className="gov-select" onChange={(event) => setSelectedTemplate(event.target.value)} value={selectedTemplate}>
                  {TEMPLATE_PRESETS.map((preset) => <option key={preset.id} value={preset.id}>{en ? preset.labelEn : preset.labelKo}</option>)}
                </select>
              </label>
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="gov-card" style={previewStyle}>
            <GridToolbar
              actions={<span className="material-symbols-outlined text-[var(--builder-primary)]">palette</span>}
              title={en ? "Live preview" : "실시간 미리보기"}
            />
            <div className="grid gap-6 p-6 xl:grid-cols-[1fr_18rem]">
              <article className="rounded-[var(--builder-radius)] border border-[var(--kr-gov-border-light)] bg-[var(--builder-surface)] p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase text-[var(--builder-primary)]">{selectedTemplatePreset.binding}</p>
                    <h3 className="mt-1 text-lg font-black text-[var(--kr-gov-text-primary)]">{en ? selectedTemplatePreset.labelEn : selectedTemplatePreset.labelKo}</h3>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-[var(--builder-accent)]">{selectedComponentPreset.layer}</span>
                </div>
                <div className="mt-5 grid gap-3 md:grid-cols-3">
                  <button className="rounded-[var(--builder-radius)] bg-[var(--builder-primary)] px-4 py-2 text-sm font-black text-white" type="button">{en ? "Save" : "저장"}</button>
                  <button className="rounded-[var(--builder-radius)] border border-[var(--builder-primary)] bg-white px-4 py-2 text-sm font-black text-[var(--builder-primary)]" type="button">{en ? "Preview" : "미리보기"}</button>
                  <button className="rounded-[var(--builder-radius)] border border-[var(--builder-warning)] bg-white px-4 py-2 text-sm font-black text-[var(--builder-warning)]" type="button">{en ? "Rollback" : "회수"}</button>
                </div>
                <div className="mt-5 overflow-hidden rounded-[var(--builder-radius)] border border-[var(--kr-gov-border-light)] bg-white">
                  <div className="grid grid-cols-3 bg-slate-50 px-4 py-3 text-xs font-black text-[var(--kr-gov-text-secondary)]">
                    <span>component</span>
                    <span>binding</span>
                    <span>scope</span>
                  </div>
                  <div className="grid grid-cols-3 px-4 py-3 text-sm">
                    <span>{en ? selectedComponentPreset.labelEn : selectedComponentPreset.labelKo}</span>
                    <span>{selectedComponentPreset.binding}</span>
                    <span>COMMON</span>
                  </div>
                </div>
              </article>
              <aside className="rounded-[var(--builder-radius)] border border-[var(--kr-gov-border-light)] bg-white p-4">
                <p className="text-sm font-black">{en ? "Installed components" : "보유 컴포넌트"}</p>
                <div className="mt-3 space-y-2">
                  {COMPONENT_PRESETS.map((preset) => (
                    <button
                      className={`flex w-full items-center justify-between rounded-[var(--builder-radius)] border px-3 py-2 text-left text-sm font-bold ${preset.id === selectedComponent ? "border-[var(--builder-primary)] bg-blue-50 text-[var(--builder-primary)]" : "border-slate-200 bg-white text-[var(--kr-gov-text-primary)]"}`}
                      key={preset.id}
                      onClick={() => setSelectedComponent(preset.id)}
                      type="button"
                    >
                      <span>{en ? preset.labelEn : preset.labelKo}</span>
                      <span className="text-[11px] text-[var(--kr-gov-text-secondary)]">{preset.binding}</span>
                    </button>
                  ))}
                </div>
              </aside>
            </div>
          </section>

          <section className="gov-card">
            <GridToolbar
              actions={<button className="gov-btn gov-btn-outline" onClick={copyPayload} type="button">{en ? "Copy JSON" : "JSON 복사"}</button>}
              title={en ? "Theme package payload" : "테마 패키지 payload"}
            />
            <textarea className="min-h-[16rem] w-full resize-y border-0 bg-slate-950 p-5 font-mono text-xs leading-5 text-slate-50 outline-none" readOnly value={payloadText} />
          </section>
        </div>
      </section>
    </>
  );
}

function CompactPreview({ kind, en }: { kind: PageKind; en: boolean }) {
  const rows = kind === "agents" ? AGENT_ROWS : kind === "patterns" ? PATTERN_ROWS : CSS_ROWS;
  return (
    <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
      {rows.slice(0, 6).map((row) => (
        <article className="rounded-[var(--kr-gov-radius)] border border-[var(--kr-gov-border-light)] bg-white p-4" key={row.name}>
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-black">{row.name}</h3>
            <span className="material-symbols-outlined text-[20px] text-[var(--kr-gov-blue)]">{kind === "agents" ? "smart_toy" : kind === "patterns" ? "schema" : "css"}</span>
          </div>
          <dl className="mt-3 grid grid-cols-1 gap-2 text-sm">
            <div><dt className="text-xs font-black text-[var(--kr-gov-text-secondary)]">Lane</dt><dd>{row.lane}</dd></div>
            <div><dt className="text-xs font-black text-[var(--kr-gov-text-secondary)]">Output</dt><dd>{row.output}</dd></div>
            <div><dt className="text-xs font-black text-[var(--kr-gov-text-secondary)]">{en ? "Owner" : "소유"}</dt><dd>{row.owner}</dd></div>
          </dl>
        </article>
      ))}
    </section>
  );
}

function BuilderGovernancePage({ kind }: { kind: PageKind }) {
  const en = isEnglish();
  const meta = KIND_META[kind];
  const [query, setQuery] = useState("");
  const rows = useMemo(() => (
    meta.rows.filter((row) => `${row.name} ${row.lane} ${row.owner} ${row.output}`.toLowerCase().includes(query.trim().toLowerCase()))
  ), [meta.rows, query]);

  logGovernanceScope("PAGE", meta.id, { language: en ? "en" : "ko", rowCount: rows.length });

  return (
    <AdminPageShell
      breadcrumbs={[
        { label: en ? "Home" : "홈", href: buildLocalizedPath("/admin/", "/en/admin/") },
        { label: en ? "System" : "시스템" },
        { label: en ? meta.titleEn : meta.titleKo }
      ]}
      sidebarVariant="system"
      title={en ? meta.titleEn : meta.titleKo}
    >
      <BuilderGovernanceNav activeId={meta.id} en={en} />
      <AdminWorkspacePageFrame>
        {kind === "theme" ? (
          <ThemeBuilderPanel en={en} />
        ) : (
          <>
            <section className="grid grid-cols-1 gap-3 xl:grid-cols-4">
              <SummaryMetricCard title={en ? "Registry Rows" : "레지스트리 행"} value={rows.length} />
              <SummaryMetricCard title={en ? "Ready" : "준비"} value={rows.filter((row) => row.status === "READY").length} />
              <SummaryMetricCard title={en ? "Active" : "활성"} value={rows.filter((row) => row.status === "ACTIVE").length} />
              <SummaryMetricCard title={en ? "Lanes" : "레인"} value={new Set(rows.map((row) => row.lane)).size} />
            </section>

            <section className="gov-card">
              <GridToolbar
                actions={<span className="material-symbols-outlined text-[var(--kr-gov-blue)]">{meta.icon}</span>}
                className="mb-4"
                title={en ? meta.titleEn : meta.titleKo}
              />
              <div className="mb-4 px-6">
                <label className="gov-label" htmlFor={`${meta.id}-search`}>{en ? "Search" : "검색"}</label>
                <input className="gov-input" id={`${meta.id}-search`} onChange={(event) => setQuery(event.target.value)} value={query} />
              </div>
              <GovernanceTable en={en} rows={rows} />
            </section>

            <CompactPreview en={en} kind={kind} />
          </>
        )}
      </AdminWorkspacePageFrame>
    </AdminPageShell>
  );
}

export function ThemeManagementMigrationPage() {
  return <BuilderGovernancePage kind="theme" />;
}

export function CssManagementMigrationPage() {
  return <BuilderGovernancePage kind="css" />;
}

export function DevelopmentPatternManagementPage() {
  return <BuilderGovernancePage kind="patterns" />;
}

export function AiDeveloperTeamManagementPage() {
  return <BuilderGovernancePage kind="agents" />;
}
