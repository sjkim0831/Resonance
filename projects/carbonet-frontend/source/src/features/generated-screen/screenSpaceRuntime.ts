export type ScreenCoordinate = {
  domain: string;
  process: string;
  step: string;
  state: string;
  actor: string;
  policy: string;
  view: string;
  device: string;
  locale: string;
  variant: string;
};

type ContractItem = { code?: string; actors?: string[]; states?: string[]; hidden?: boolean; disabled?: boolean; [key: string]: unknown };
type ScreenLike = {
  pageId: string;
  processCode: string;
  stepCode: string;
  actorCode: string;
  screenType: string;
  templateCode: string;
  specification: Record<string, unknown>;
  traceability: Record<string, unknown>;
  screenCoordinate?: ScreenCoordinate;
  screenCoordinateKey?: string;
};
export type RuntimeContext = { actorCode?: string; state?: string; device?: string; locale?: string; variant?: string };
export type ScreenContractIssue = { code: string; severity: "ERROR" | "WARNING"; message: string };
export type MaterializedScreen = {
  coordinate: ScreenCoordinate;
  coordinateKey: string;
  fields: ContractItem[];
  sections: ContractItem[];
  actions: ContractItem[];
  issues: ScreenContractIssue[];
  valid: boolean;
};

const cache = new Map<string, MaterializedScreen>();
const CACHE_LIMIT = 500;
const array = (value: unknown): ContractItem[] => Array.isArray(value) ? value.filter(Boolean) as ContractItem[] : [];
const strings = (value: unknown): string[] => Array.isArray(value) ? value.map(String).filter(Boolean) : [];
const domainOf = (screen: ScreenLike) => String(screen.processCode || "COMMON").split(/[_:/.-]/)[0] || "COMMON";
const encode = (coordinate: ScreenCoordinate) => [
  coordinate.domain, coordinate.process, coordinate.step, coordinate.state, coordinate.actor,
  coordinate.policy, coordinate.view, coordinate.device, coordinate.locale, coordinate.variant,
].map(encodeURIComponent).join("::");

export function resolveScreenCoordinate(screen: ScreenLike, context: RuntimeContext = {}): ScreenCoordinate {
  const source = screen.screenCoordinate;
  const states = strings(screen.specification.states);
  return {
    domain: source?.domain || domainOf(screen),
    process: source?.process || screen.processCode,
    step: source?.step || screen.stepCode,
    state: context.state || source?.state || states[0] || "READY",
    actor: context.actorCode || source?.actor || screen.actorCode,
    policy: source?.policy || `${context.actorCode || screen.actorCode}:DEFAULT`,
    view: source?.view || String(screen.screenType || "DETAIL").toUpperCase(),
    device: context.device || source?.device || "ADAPTIVE",
    locale: context.locale || source?.locale || "MULTI",
    variant: context.variant || source?.variant || screen.templateCode || "KRDS_DEFAULT",
  };
}

function isApplicable(item: ContractItem, coordinate: ScreenCoordinate) {
  if (item.hidden) return false;
  const actors = strings(item.actors);
  const states = strings(item.states);
  return (!actors.length || actors.includes(coordinate.actor)) && (!states.length || states.includes(coordinate.state));
}

function duplicateCodes(kind: string, values: ContractItem[]): ScreenContractIssue[] {
  const seen = new Set<string>();
  const duplicate = new Set<string>();
  values.forEach((item, index) => {
    const code = String(item.code || `${kind}_${index + 1}`);
    if (seen.has(code)) duplicate.add(code);
    seen.add(code);
  });
  return [...duplicate].map(code => ({ code: `DUPLICATE_${kind}_${code}`, severity: "ERROR", message: `${kind} 코드가 중복되었습니다: ${code}` }));
}

export function validateScreenContract(screen: ScreenLike): ScreenContractIssue[] {
  const spec = screen.specification || {};
  const fields = array(spec.fields);
  const sections = array(spec.sections);
  const actions = array(spec.actions || spec.commands);
  const issues = [
    ...duplicateCodes("FIELD", fields),
    ...duplicateCodes("SECTION", sections),
    ...duplicateCodes("ACTION", actions),
  ];
  if (!fields.length) issues.push({ code: "FIELDS_REQUIRED", severity: "ERROR", message: "입력·출력 필드 계약이 없습니다." });
  if (!sections.length) issues.push({ code: "SECTIONS_REQUIRED", severity: "ERROR", message: "화면 섹션 계약이 없습니다." });
  if (!actions.length) issues.push({ code: "ACTIONS_REQUIRED", severity: "ERROR", message: "업무 명령 계약이 없습니다." });
  if (!array(spec.dataContracts).length) issues.push({ code: "DATA_CONTRACT_REQUIRED", severity: "ERROR", message: "공통 데이터 계약이 없습니다." });
  if (!array(spec.apiContracts).length) issues.push({ code: "API_CONTRACT_REQUIRED", severity: "ERROR", message: "API 계약이 없습니다." });
  if (!array(spec.permissions).length) issues.push({ code: "POLICY_REQUIRED", severity: "ERROR", message: "액터·권한 정책이 없습니다." });
  if (!array(spec.validations).length) issues.push({ code: "VALIDATION_REQUIRED", severity: "ERROR", message: "검증 규칙이 없습니다." });
  const scenarios = strings(screen.traceability?.requiredScenarioTypes);
  for (const scenario of ["HAPPY_PATH", "AUTHORITY", "ISOLATION", "EXCEPTION", "RECOVERY"]) {
    if (!scenarios.includes(scenario)) issues.push({ code: `SCENARIO_${scenario}`, severity: "ERROR", message: `${scenario} 테스트 시나리오가 없습니다.` });
  }
  return issues;
}

export function materializeScreen(screen: ScreenLike, context: RuntimeContext = {}): MaterializedScreen {
  const coordinate = resolveScreenCoordinate(screen, context);
  const coordinateKey = encode(coordinate);
  const cacheKey = `${screen.pageId}::${coordinateKey}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;
  const issues = validateScreenContract(screen);
  const materialized: MaterializedScreen = {
    coordinate,
    coordinateKey,
    fields: array(screen.specification.fields).filter(item => isApplicable(item, coordinate)),
    sections: array(screen.specification.sections).filter(item => isApplicable(item, coordinate)),
    actions: array(screen.specification.actions || screen.specification.commands).filter(item => isApplicable(item, coordinate)),
    issues,
    valid: !issues.some(issue => issue.severity === "ERROR"),
  };
  if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value as string);
  cache.set(cacheKey, materialized);
  return materialized;
}

export function clearScreenMaterializationCache() {
  cache.clear();
}
