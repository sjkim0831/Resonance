#!/usr/bin/env node
import { readdir, readFile, writeFile, mkdir, access } from "node:fs/promises";
import { resolve, dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { inspectWorkstreams, inspectChangedFiles } from "../src/features/work-implementation/parallel/inspectWorkstreams.mjs";

const source = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repo = resolve(source, "../../..");
const registry = join(source, "src/features/work-implementation/parallel");
const args = process.argv.slice(2);
const flags = {};
for (let i = 0; i < args.length; i += 2) {
  if (!["--mode","--stream","--base","--catalog","--evidence","--out"].includes(args[i]) || !args[i + 1] || args[i + 1].startsWith("--")) throw new Error("인자 오류: --mode plan|changes|integrate --stream ID --base COMMIT [--catalog FILE] [--evidence FILE] [--out FILE]");
  flags[args[i].slice(2)] = args[i + 1];
}
const mode = flags.mode || "plan";
if (!["plan","changes","integrate"].includes(mode)) throw new Error("지원하지 않는 mode");
const policy = JSON.parse(await readFile(join(registry, "integration-policy.json"), "utf8"));
const files = (await readdir(join(registry, "workstreams"))).filter(f => f.endsWith(".json")).sort();
const streams = await Promise.all(files.map(async f => JSON.parse(await readFile(join(registry, "workstreams", f), "utf8"))));
const target = streams.find(s => s.id === flags.stream);
const existingPaths = [];
for (const p of streams.flatMap(s => s.pages || [])) {
  if (typeof p.sourcePath !== "string") continue;
  const full = resolve(repo, p.sourcePath);
  if (relative(repo, full).startsWith("..")) continue;
  try { await access(full); existingPaths.push(p.sourcePath); } catch {}
}
const git = (...a) => execFileSync("git", ["-c", "safe.directory=" + repo.replaceAll("\\","/"), "-C", repo, ...a], { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 }).trim();
const additions = [];
let changedFiles = [], head = null, base = null;
if (mode !== "plan") {
  if (!target || !flags.base || !/^[a-fA-F0-9]{7,40}$/.test(flags.base)) throw new Error("--stream 및 명시적인 --base Commit SHA가 필요합니다.");
  base = git("rev-parse", "--verify", flags.base + "^{commit}");
  head = git("rev-parse", "HEAD");
  try { git("merge-base", "--is-ancestor", base, head); } catch { throw new Error("base가 현재 HEAD의 선행 Commit이 아닙니다."); }
  changedFiles = [...new Set([...git("diff", "--name-only", "--no-renames", "-z", base).split("\0"), ...git("ls-files", "--others", "--exclude-standard", "-z").split("\0")].filter(Boolean))];
  for (const f of inspectChangedFiles(target, policy, changedFiles)) additions.push({ ...f, message: f.path, streamIds: [target.id], severity: "ERROR" });
  if (!changedFiles.length) additions.push({ code: "NO_CHANGES", message: "통합할 변경이 없습니다.", streamIds: [target.id], severity: "PENDING" });
  if (mode === "integrate" && git("status", "--porcelain").length) additions.push({ code: "UNCOMMITTED_CHANGES", message: "Commit되지 않은 변경이 있습니다.", streamIds: [target.id], severity: "ERROR" });
}
let catalog;
if (flags.catalog) {
  const body = JSON.parse(await readFile(resolve(flags.catalog), "utf8"));
  if (!Array.isArray(body.businessTypes)) throw new Error("공식 카탈로그 응답의 businessTypes가 필요합니다.");
  catalog = body.businessTypes.flatMap(b => b.processes || []);
}
if (flags.evidence) {
  if (!target || mode !== "integrate") throw new Error("evidence는 integrate에서만 사용합니다.");
  const e = JSON.parse(await readFile(resolve(flags.evidence), "utf8"));
  target.evidence = e.checks;
  target.state = e.state;
  if (e.streamId !== target.id || e.commit !== head) additions.push({ code: "EVIDENCE_IDENTITY", message: "증거의 작업/Commit 불일치", streamIds: [target.id], severity: "ERROR" });
  for (const check of policy.requiredChecks) {
    const record = e.checks?.[check];
    if (!record?.artifact) continue;
    const artifact = resolve(dirname(resolve(flags.evidence)), record.artifact);
    try {
      const { createHash } = await import("node:crypto");
      const actual = createHash("sha256").update(await readFile(artifact)).digest("hex");
      if (actual !== record.sha256) throw new Error("sha");
    } catch { additions.push({ code: "EVIDENCE_ARTIFACT", message: check + " 증거 파일/SHA 불일치", streamIds: [target.id], severity: "ERROR" }); }
  }
}
if (mode === "integrate" && !catalog) additions.push({ code: "CATALOG_REQUIRED", message: "현재 공식 카탈로그 응답 파일이 필요합니다.", streamIds: [target.id], severity: "PENDING" });
if (mode === "integrate" && !flags.evidence) additions.push({ code: "EVIDENCE_REQUIRED", message: "대상 Commit의 실행 증거가 필요합니다.", streamIds: [target.id], severity: "PENDING" });
const result = inspectWorkstreams(streams, policy, { existingPaths, catalog, head: head || undefined });
const findings = [...result.findings, ...additions];
const relevant = findings.filter(f => f.severity === "ERROR" || !target || f.streamIds.includes(target.id));
const blocked = relevant.some(f => f.severity === "ERROR") || (mode === "integrate" && relevant.length > 0);
const report = { schemaVersion: 1, generatedAt: new Date().toISOString(), mode, streamId: target?.id || null, head, base, status: blocked ? "BLOCKED" : mode === "integrate" ? "READY_FOR_INTEGRATOR" : "STATIC_SCOPE_CHECKED", canonicalDefinitionsChanged: false, workstreamCount: streams.length, stepCount: streams.reduce((n,s)=>n+s.steps.length,0), changedFiles, findings: relevant };
if (flags.out) { const path = resolve(flags.out); await mkdir(dirname(path), { recursive: true }); await writeFile(path, JSON.stringify(report,null,2)+"\n"); }
console.log(JSON.stringify(report,null,2));
process.exitCode = blocked ? 1 : 0;

