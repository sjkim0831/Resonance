export type SurveyAmountRow = { sectionCode: string; sectionLabel: string; materialName: string; amount: string };

/** Missing is not zero. Explicit zero is allowed, but output mass must be positive. */
export function validateSurveyAmounts(rows: SurveyAmountRow[]) {
  const invalid = rows.filter((row) => {
    const value = String(row.amount ?? "").trim().replace(/,/g, "");
    return !value || !Number.isFinite(Number(value)) || Number(value) < 0;
  });
  const outputMass = rows.filter((row) => row.sectionCode === "OUTPUT_PRODUCTS")
    .reduce((sum, row) => sum + (Number(String(row.amount ?? "").replace(/,/g, "")) || 0), 0);
  return { invalid, outputMass, valid: invalid.length === 0 && outputMass > 0 };
}
