import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import ts from "typescript";

const root = resolve(process.argv[2] || "src/features");
const out = resolve(process.argv[3] || ".cache/krds-theme-coverage/report.json");
const markdownOut = out.replace(/\.json$/i, ".md");
const started = performance.now();
const globalRootSource = await readFile(resolve("index.html"), "utf8").catch(() => "");
const userChromeSource = await readFile(resolve("src/components/user-shell/UserPortalChrome.tsx"), "utf8").catch(() => "");
const globalKrdsTheme = /<html\b[^>]*data-screen-theme=["']krds-v1["']/.test(globalRootSource);
const routeGovernmentBarSuppressed = /export function UserGovernmentBar[\s\S]*?return null;[\s\S]*?\n}/.test(userChromeSource);

async function files(directory, result = []) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) await files(path, result);
    else if (/Page\.tsx$|MigrationPage\.tsx$/.test(entry.name)) result.push(path);
  }
  return result;
}

const count = (source, expression) => [...source.matchAll(expression)].length;
function controlStats(source, file) {
  const parsed = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let totalControls = 0;
  let styledControls = 0;
  const visit = node => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName.getText(parsed);
      if (["button", "input", "select", "textarea", "table"].includes(tag)) {
        totalControls += 1;
        const governed = node.attributes.properties.some(attribute => {
          if (!ts.isJsxAttribute(attribute)) return false;
          return ["class", "className", "data-krds-unstyled"].includes(attribute.name.getText(parsed));
        });
        if (governed) styledControls += 1;
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(parsed);
  return { totalControls, styledControls, rawControls: totalControls - styledControls };
}

function darkSurfaceStats(source, file) {
  const parsed = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let darkFullSurfaces = 0;
  let darkClassAttributes = 0;
  const visit = node => {
    if (ts.isJsxAttribute(node) && ["class", "className"].includes(node.name.getText(parsed)) && node.initializer) {
      const text = node.initializer.getText(parsed);
      const dark = /\b(?:bg|from)-(?:slate|gray)-(?:800|900|950)\b|(?:#0f172a|#111827)/.test(text);
      if (dark) {
        darkClassAttributes += 1;
        if (/\b(?:min-h-screen|h-screen)\b/.test(text) && !/\bprint:/.test(text)) darkFullSurfaces += 1;
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(parsed);
  const specializedWorkspace = /(?:builder|studio|workspace|monitoring|security|codex|ai-|operations-center|db-|omniverse|backup|version-management)/i.test(file);
  return {
    darkClassAttributes,
    darkFullSurfaces,
    darkPolicy: darkFullSurfaces === 0 ? "ACCENT_ONLY" : specializedWorkspace ? "INTENTIONAL_WORKSPACE" : "REVIEW_LIGHT_CONVERSION",
  };
}
const rows = [];
for (const file of await files(root)) {
  const source = await readFile(file, "utf8");
  const directKrdsTheme = /data-(?:mypage|screen)-theme=["']krds-v1["']/.test(source);
  const inheritedKrdsTheme = /<AdminPageShell\b/.test(source);
  const krdsTheme = directKrdsTheme || inheritedKrdsTheme || globalKrdsTheme;
  const commonJsxComponents = count(source, /<(?:Common\w+|MypageKrdsLayout|AdminPageShell|AdminWorkspace\w+|UserPortal\w+|PageStatusNotice|SummaryMetricCard|ContextKeyStrip|StandardUserFooter|FiveLayerFormRenderer)\b/g) + count(source, /\bkrds-(?:component|control)\b/g);
  const sharedInfrastructure = count(source, /from ["']\.\.\/\.\.\/(?:components|app\/components)\//g)
    + count(source, /from ["']\.\.\/(?:contract-runtime|home-entry)\//g)
    + count(source, /export \{[^}]+\} from ["']\.\.\//g)
    + count(source, /import\s+\{[^}]*\b[A-Z]\w*(?:Page|Layout|Renderer|Footer)\b[^}]*\}\s+from ["'](?:\.\.\/|\.\/)/gs)
    + count(source, /import\s+contract\s+from ["'][^"']+\.contract\.json["']/g);
  const commonComponents = commonJsxComponents + sharedInfrastructure;
  const commonPolicy = commonJsxComponents > 0 ? "SHARED_COMPONENT" : sharedInfrastructure > 0 ? "SHARED_INFRASTRUCTURE" : "GLOBAL_THEME_ONLY";
  const darkIndependent = count(source, /bg-(?:slate|gray)-(?:8|9)\d\d|from-(?:slate|gray)-(?:8|9)\d\d|radial-gradient[^\n]*(?:#0f172a|#111827)/g);
  const { darkClassAttributes, darkFullSurfaces, darkPolicy } = darkSurfaceStats(source, file);
  const { totalControls, styledControls, rawControls } = controlStats(source, file);
  const governmentBandReferences = count(source, /<UserGovernmentBar\b/g);
  const duplicatedGovernmentBand = routeGovernmentBarSuppressed ? 0 : governmentBandReferences;
  const score = (krdsTheme ? 0 : 20) + darkFullSurfaces * 20 + Math.min(darkClassAttributes, 3) * 2 + rawControls - commonComponents * 2 + duplicatedGovernmentBand * 10;
  rows.push({
    file: relative(resolve("."), file).replaceAll("\\", "/"),
    krdsTheme,
    themeSource: directKrdsTheme ? "DIRECT" : inheritedKrdsTheme ? "ADMIN_SHELL" : globalKrdsTheme ? "GLOBAL_ROOT" : "NONE",
    commonComponents,
    commonPolicy,
    darkIndependent,
    darkClassAttributes,
    darkFullSurfaces,
    darkPolicy,
    totalControls,
    styledControls,
    rawControls,
    governmentBandReferences,
    duplicatedGovernmentBand,
    divergenceScore: Math.max(0, score),
  });
}
rows.sort((a, b) => b.divergenceScore - a.divergenceScore || a.file.localeCompare(b.file));
const summary = {
  totalPages: rows.length,
  krdsThemePages: rows.filter(row => row.krdsTheme).length,
  pagesWithCommonComponents: rows.filter(row => row.commonComponents > 0).length,
  darkIndependentPages: rows.filter(row => row.darkIndependent > 0).length,
  darkFullSurfacePages: rows.filter(row => row.darkFullSurfaces > 0).length,
  intentionalDarkWorkspacePages: rows.filter(row => row.darkPolicy === "INTENTIONAL_WORKSPACE").length,
  darkReviewPages: rows.filter(row => row.darkPolicy === "REVIEW_LIGHT_CONVERSION").length,
  duplicateGovernmentBandPages: rows.filter(row => row.duplicatedGovernmentBand > 0).length,
  governmentBandReferencePages: rows.filter(row => row.governmentBandReferences > 0).length,
  routeGovernmentBarSuppressed,
  totalControls: rows.reduce((sum, row) => sum + row.totalControls, 0),
  styledControls: rows.reduce((sum, row) => sum + row.styledControls, 0),
  rawControls: rows.reduce((sum, row) => sum + row.rawControls, 0),
  rawControlPages: rows.filter(row => row.rawControls > 0).length,
  durationMs: Math.round(performance.now() - started),
};
const report = { schema: "carbonet.krds-theme-coverage/v1", generatedAt: new Date().toISOString(), summary, rows };
await mkdir(dirname(out), { recursive: true });
await writeFile(out, `${JSON.stringify(report, null, 2)}\n`);
await writeFile(markdownOut, `# KRDS theme coverage\n\n- Total pages: ${summary.totalPages}\n- KRDS theme: ${summary.krdsThemePages}\n- Common components: ${summary.pagesWithCommonComponents}\n- Pages with local dark accents: ${summary.darkIndependentPages}\n- Full-page dark surfaces: ${summary.darkFullSurfacePages}\n- Intentional dark workspaces: ${summary.intentionalDarkWorkspacePages}\n- Dark pages requiring light-theme review: ${summary.darkReviewPages}\n- Duplicate government bands rendered: ${summary.duplicateGovernmentBandPages}\n- Suppressed route-level band references: ${summary.governmentBandReferencePages}\n- Scan: ${summary.durationMs}ms\n\n| Rank | File | Score | Theme | Common | Dark accents | Full dark | Policy | Raw controls |\n|---:|---|---:|:---:|---:|---:|---:|:---:|---:|\n${rows.slice(0, 50).map((row, index) => `| ${index + 1} | ${row.file} | ${row.score} | ${row.hasTheme ? "Y" : "N"} | ${row.commonComponents} | ${row.darkIndependent} | ${row.darkFullSurfaces} | ${row.darkPolicy} | ${row.rawControls} |`).join("\\n")}\n`);
await writeFile(markdownOut, `# KRDS theme coverage\n\n- Total pages: ${summary.totalPages}\n- KRDS theme: ${summary.krdsThemePages}\n- Common components or infrastructure: ${summary.pagesWithCommonComponents}\n- Global-theme-only pages: ${summary.totalPages - summary.pagesWithCommonComponents}\n- Pages with local dark accents: ${summary.darkIndependentPages}\n- Full-page dark surfaces: ${summary.darkFullSurfacePages}\n- Intentional dark workspaces: ${summary.intentionalDarkWorkspacePages}\n- Dark pages requiring light-theme review: ${summary.darkReviewPages}\n- Duplicate government bands rendered: ${summary.duplicateGovernmentBandPages}\n- Suppressed route-level band references: ${summary.governmentBandReferencePages}\n- Scan: ${summary.durationMs}ms\n\n| Rank | File | Score | Theme | Common | Common policy | Dark accents | Full dark | Dark policy | Raw controls |\n|---:|---|---:|:---:|---:|:---:|---:|---:|:---:|---:|\n${rows.slice(0, 50).map((row, index) => `| ${index + 1} | ${row.file} | ${row.divergenceScore} | ${row.krdsTheme ? "Y" : "N"} | ${row.commonComponents} | ${row.commonPolicy} | ${row.darkIndependent} | ${row.darkFullSurfaces} | ${row.darkPolicy} | ${row.rawControls} |`).join("\n")}\n`);
console.log(JSON.stringify({ success: true, out, markdownOut, summary, top: rows.slice(0, 10) }, null, 2));
