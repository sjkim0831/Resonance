export type DefinitionRow = Record<string, unknown>;
export type ComparisonRow = { key: string; processCode: string; stepCode: string; name: string; status: string; differences: string[] };
const keyOf = (row: DefinitionRow, step: boolean) => JSON.stringify(step ? [row.processCode, row.stepCode] : [row.processCode]);
export function compareDefinitions(reference: DefinitionRow[], managed: DefinitionRow[], step: boolean): ComparisonRow[] {
  const index = new Map<string, DefinitionRow[]>();
  for (const row of managed) { const key = keyOf(row, step); index.set(key, [...(index.get(key) || []), row]); }
  const seen = new Set<string>();
  const fields = step ? ["stepName", "stepOrder", "actorCode", "fromState", "commandCode", "toState", "inputContract", "outputContract", "completionRule"] : ["processName", "domainCode"];
  const result = reference.map(row => {
    const key = keyOf(row, step), matches = index.get(key) || [], duplicate = seen.has(key);
    seen.add(key);
    const differences = matches.length === 1 ? fields.filter(field => !Object.prototype.hasOwnProperty.call(row, field) || !Object.prototype.hasOwnProperty.call(matches[0], field) || row[field] !== matches[0][field]) : [];
    return { key, processCode: String(row.processCode || ""), stepCode: step ? String(row.stepCode || "") : "", name: String(row[step ? "stepName" : "processName"] || ""), status: duplicate || matches.length > 1 ? "DUPLICATE" : !matches.length ? "MISSING_IN_MANAGEMENT" : differences.length ? "DIFFERENT_OR_UNVERIFIED" : "MATCH", differences };
  });
  for (const [key, rows] of index) if (!seen.has(key)) result.push({ key, processCode: String(rows[0].processCode || ""), stepCode: step ? String(rows[0].stepCode || "") : "", name: String(rows[0][step ? "stepName" : "processName"] || ""), status: "MANAGEMENT_ONLY_SCOPE_REVIEW", differences: [] });
  return result;
}
