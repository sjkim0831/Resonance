const STATES = ["PLANNED", "IN_PROGRESS", "REVIEW", "INTEGRATED"];
export const normalizeRoute = value => String(value).split(/[?#]/)[0].replace(/\{[^/}]+\}|:[^/]+/g, ":param").replace(/\/+$/, "") || "/";
const safePath = p => typeof p === "string" && p.length > 0 && !p.startsWith("/") && !p.includes("\\") && !p.split("/").some(x => x === ".." || x === "." || x === "") && !/[*?:]/.test(p);
const within = (file, scope) => file === scope || file.startsWith(scope + "/");
const overlap = (a, b) => within(a, b) || within(b, a);
export function inspectWorkstreams(streams, policy, options = {}) {
  const findings = [];
  const add = (code, message, ids = [], severity = "ERROR") => findings.push({ code, message, streamIds: ids, severity });
  if (!Array.isArray(streams) || !policy || !Array.isArray(policy.protectedPaths) || !Array.isArray(policy.requiredChecks)) {
    return { findings: [{ code: "INVALID_POLICY", message: "작업 명세 또는 통합 정책이 올바르지 않습니다.", streamIds: [], severity: "ERROR" }], conflictCount: 1, integrationReady: false };
  }
  const seen = new Map();
  const claim = (kind, key, id) => {
    const identity = kind + ":" + key;
    if (seen.has(identity)) add("DUPLICATE_" + kind, key + " 중복 등록", [seen.get(identity), id]);
    else seen.set(identity, id);
  };
  const scopes = [];
  for (const s of streams) {
    if (!s || typeof s.id !== "string" || !s.id || typeof s.name !== "string" || !STATES.includes(s.state) || !Array.isArray(s.ownedPaths) || !s.ownedPaths.length || !Array.isArray(s.steps) || !Array.isArray(s.pages) || !Array.isArray(s.apis) || !Array.isArray(s.permissions) || !Array.isArray(s.dependencies) || !Array.isArray(s.migrationVersions)) {
      add("INVALID_MANIFEST", "필수 작업 명세가 누락되었습니다.", [s?.id || "unknown"]); continue;
    }
    claim("STREAM", s.id, s.id);
    for (const p of s.ownedPaths) {
      if (!safePath(p)) { add("INVALID_PATH", "잘못된 소유 경로: " + p, [s.id]); continue; }
      if (policy.protectedPaths.some(q => overlap(p, q))) add("PROTECTED_PATH", "통합 담당 전용 경로: " + p, [s.id]);
      for (const other of scopes) if (other.id !== s.id && overlap(p, other.path)) add("OWNERSHIP_OVERLAP", p + " ↔ " + other.path, [other.id, s.id]);
      scopes.push({ id: s.id, path: p });
    }
    const pageIds = new Set(s.pages.map(p => p.pageId));
    for (const st of s.steps) {
      if (!st.processCode || !st.stepCode || !st.expectedVersion || !Array.isArray(st.pageIds) || !st.pageIds.length) {
        add("INVALID_STEP", "절차 코드·예상 버전·화면 연결이 필요합니다.", [s.id]); continue;
      }
      claim("STEP", st.processCode + "/" + st.stepCode, s.id);
      for (const pageId of st.pageIds) if (!pageIds.has(pageId)) add("MISSING_PAGE", st.stepCode + " → " + pageId, [s.id]);
    }
    for (const p of s.pages) {
      if (!p.pageId || typeof p.route !== "string" || !p.route.startsWith("/") || p.route.startsWith("//") || p.route.includes("\\") || !safePath(p.sourcePath)) {
        add("INVALID_PAGE", "화면 경로 또는 소스 경로가 올바르지 않습니다.", [s.id]); continue;
      }
      claim("PAGE", p.pageId, s.id); claim("ROUTE", normalizeRoute(p.route), s.id);
      if (!s.ownedPaths.some(scope => within(p.sourcePath, scope))) add("PAGE_OUTSIDE_OWNER", p.sourcePath, [s.id]);
      if (options.existingPaths && !options.existingPaths.includes(p.sourcePath)) add("SOURCE_MISSING", p.sourcePath, [s.id]);
      if (!Array.isArray(p.permissionCodes) || !p.permissionCodes.length) add("PERMISSION_UNRESOLVED", p.route + " 권한 연결 미확인", [s.id], "PENDING");
      else for (const code of p.permissionCodes) if (!s.permissions.some(x => x.code === code) && !(policy.sharedPermissions || []).includes(code)) add("MISSING_PERMISSION", p.route + " → " + code, [s.id]);
    }
    for (const p of s.permissions) {
      if (!p.code) add("INVALID_PERMISSION", "권한 코드가 필요합니다.", [s.id]);
      else claim("PERMISSION", p.code, s.id);
    }
    for (const a of s.apis) {
      if (!["GET","POST","PUT","PATCH","DELETE"].includes(a.method) || typeof a.path !== "string" || !a.path.startsWith("/") || a.path.startsWith("//") || a.path.includes("\\")) add("INVALID_API", "API 명세 오류", [s.id]);
      else claim("API", a.method + " " + normalizeRoute(a.path), s.id);
    }
    for (const version of s.migrationVersions) {
      if (!/^\d+$/.test(String(version))) add("INVALID_MIGRATION", "Migration 버전은 숫자로 예약해야 합니다.", [s.id]);
      claim("MIGRATION", String(version), s.id);
    }
    for (const d of s.dependencies) {
      const contract = (policy.contracts || []).find(c => c.id === d.contractId);
      if (!contract || contract.version !== d.version) add("CONTRACT_MISMATCH", d.contractId + " 계약 버전 불일치", [s.id]);
      else if (contract.status !== "CONFIRMED") add("CONTRACT_PENDING", d.contractId + " 계약 확정 대기", [s.id], "PENDING");
    }
    for (const check of policy.requiredChecks) {
      const e = s.evidence?.[check];
      if (!e || e.status !== "PASS" || !e.commit || !e.artifact) add("EVIDENCE_PENDING", check + " 실행 증거 대기", [s.id], "PENDING");
      else if (options.head && e.commit !== options.head) add("STALE_EVIDENCE", check + " 검증 Commit이 통합 대상과 다릅니다.", [s.id]);
    }
    if (s.state !== "REVIEW") add("REVIEW_PENDING", "통합 검토 제출 전입니다.", [s.id], "PENDING");
    if (options.catalog) {
      for (const st of s.steps) {
        const proc = options.catalog.find(p => p.processCode === st.processCode);
        if (!proc || !proc.steps?.some(x => x.stepCode === st.stepCode)) add("CANONICAL_STEP_MISSING", st.processCode + "/" + st.stepCode, [s.id]);
        else if (String(proc.processVersion) !== st.expectedVersion) add("DEFINITION_VERSION_CHANGED", st.processCode + " 정의 버전 재대조 필요", [s.id]);
      }
    }
  }
  const conflicts = findings.filter(f => f.severity === "ERROR");
  return { findings, conflictCount: conflicts.length, integrationReady: findings.length === 0 };
}
export function inspectChangedFiles(stream, policy, paths) {
  return paths.flatMap(path => {
    if (!safePath(path)) return [{ code: "INVALID_PATH", path }];
    if (policy.protectedPaths.some(p => within(path, p))) return [{ code: "PROTECTED_PATH", path }];
    return stream.ownedPaths.some(p => within(path, p)) ? [] : [{ code: "OUTSIDE_OWNER", path }];
  });
}

