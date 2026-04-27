package egovframework.com.feature.admin.service.impl;

import java.util.Map;
import java.util.Set;

final class LimeEmissionCalculator {
    private final EmissionCalculationSupport support;
    private final double caco3Factor;

    LimeEmissionCalculator(EmissionCalculationSupport support, double caco3Factor) {
        this.support = support;
        this.caco3Factor = caco3Factor;
    }

    CalculationResult calculateTier1(CalculationContext context) {
        Set<Integer> lineIndexes = support.lineIndexes(context.lineValues, "MLI");
        if (lineIndexes.isEmpty()) {
            throw new IllegalArgumentException("석회 Tier 1은 LIME_TYPE과 MLI를 유형별 반복 입력으로 제공해야 합니다.");
        }

        double total = 0d;
        CalculationTrace trace = new CalculationTrace();
        for (Integer lineNo : lineIndexes) {
            double mass = support.lineNumber(context.lineValues, "MLI", lineNo);
            AppliedFactor factor = support.applyResolvedFactor(
                    trace,
                    "EF_LIME[" + lineNo + "]",
                    support.resolveLimeTier1Factor(support.lineText(context.lineTextValues, "LIME_TYPE", lineNo), context.factorValues, lineNo),
                    support.lineText(context.lineTextValues, "LIME_TYPE", lineNo),
                    EmissionCalculationSupport.LIME_FACTOR_POLICY
            );
            double lineTotal = mass * factor.factor.value;
            total += lineTotal;
            trace.addLog("석회 합계", lineNo, "Ml,i × EF석회,i", support.format("%s × %s", mass, factor.factor.value), lineTotal, factor.note);
        }
        trace.addLog("최종 합계", null, "Σ(EF석회,i × Ml,i)", support.format("%s", total), total, null);
        return new CalculationResult(total, context.definition.formulaSummary, context.definition.formulaDisplay, support.format("CO2 = %s", total), trace.appliedFactors(), trace.logs(), trace.defaultApplied());
    }

    CalculationResult calculateTier2(CalculationContext context) {
        Set<Integer> lineIndexes = support.lineIndexes(context.lineValues, "MLI", "CAO_CONTENT", "CAO_MGO_CONTENT", "MD", "CD", "FD", "X", "Y");
        double total = 0d;
        CalculationTrace trace = new CalculationTrace();
        for (Integer lineNo : lineIndexes) {
            LimeTier2LineCalculation lineCalculation = resolveTier2LineCalculation(context.lineValues, context.lineTextValues, context.factorValues, lineNo);
            if (lineCalculation.mass == 0d) {
                continue;
            }
            total += lineCalculation.lineTotal;
            trace.addResolvedFactor("EF_LIME[" + lineNo + "]", lineCalculation.factor);
            trace.addResolvedFactor("CF_LKD[" + lineNo + "]", lineCalculation.cfLkd);
            trace.addResolvedFactor("C_H[" + lineNo + "]", lineCalculation.hydrationCorrection);
            trace.addLog("석회 배출계수", lineNo, "EF석회,i", support.format("%s", lineCalculation.factor.value), lineCalculation.factor.value, lineCalculation.factorNote);
            trace.addLog("LKD 보정계수", lineNo, "CF_lkd,i", support.format("%s", lineCalculation.cfLkd.value), lineCalculation.cfLkd.value, lineCalculation.cfLkdNote);
            trace.addLog("수화석회 보정계수", lineNo, "C_h,i", support.format("%s", lineCalculation.hydrationCorrection.value), lineCalculation.hydrationCorrection.value, lineCalculation.hydrationCorrectionNote);
            trace.addLog("석회 합계", lineNo, "Ml,i × EF석회,i × CF_lkd,i × C_h,i", support.format("%s × %s × %s × %s", lineCalculation.mass, lineCalculation.factor.value, lineCalculation.cfLkd.value, lineCalculation.hydrationCorrection.value), lineCalculation.lineTotal, null);
        }
        trace.addLog("최종 합계", null, "Σ(EF석회,i × Ml,i × CF_lkd,i × C_h,i)", support.format("%s", total), total, null);
        return new CalculationResult(total, context.definition.formulaSummary, context.definition.formulaDisplay, support.format("CO2 = %s", total), trace.appliedFactors(), trace.logs(), trace.defaultApplied());
    }

    CalculationResult calculateTier3(CalculationContext context) {
        Set<Integer> carbonateLines = support.lineIndexes(context.lineValues, "MI", "FI");
        double carbonateTotal = 0d;
        CalculationTrace trace = new CalculationTrace();
        for (Integer lineNo : carbonateLines) {
            AppliedFactor carbonateFactor = support.applyResolvedFactor(
                    trace,
                    "EFI[" + lineNo + "]",
                    support.resolveCarbonateLineFactor(context.lineValues, context.lineTextValues, context.factorValues, "EFI", "CARBONATE_TYPE", lineNo, "lime-carbonate-" + lineNo),
                    support.lineText(context.lineTextValues, "CARBONATE_TYPE", lineNo),
                    EmissionCalculationSupport.CARBONATE_FACTOR_POLICY
            );
            double mass = support.lineNumber(context.lineValues, "MI", lineNo);
            double ratioValue = support.ratio(support.lineNumber(context.lineValues, "FI", lineNo));
            double lineTotal = carbonateFactor.factor.value * mass * ratioValue;
            carbonateTotal += lineTotal;
            trace.addLog("탄산염 합계", lineNo, "EFi × Mi × Fi", support.format("%s × %s × %s", carbonateFactor.factor.value, mass, ratioValue), lineTotal, carbonateFactor.note);
        }
        double md = support.number(context.scalarValues, "MD");
        double cd = support.ratio(support.number(context.scalarValues, "CD"));
        double fd = support.ratio(support.number(context.scalarValues, "FD"));
        AppliedFactor efd = support.applyScalarFactor(trace, "EFD", support.resolveCarbonateScalarFactor(context.scalarValues, context.scalarTexts, context.factorValues, "EFD", "LKD_CARBONATE_TYPE", caco3Factor), context.scalarTexts.get("LKD_CARBONATE_TYPE"), EmissionCalculationSupport.CARBONATE_FACTOR_POLICY);
        double lkdLoss = md * cd * (1d - fd) * efd.factor.value;
        trace.addLog("LKD 보정", null, "Md × Cd × (1 - Fd) × EFd", support.format("%s × %s × (1 - %s) × %s", md, cd, fd, efd.factor.value), lkdLoss, efd.note);
        double total = carbonateTotal - lkdLoss;
        trace.addLog("최종 합계", null, "Σ(EFi × Mi × Fi) - LKD 보정", support.format("%s - %s", carbonateTotal, lkdLoss), total, null);
        return new CalculationResult(total, context.definition.formulaSummary, context.definition.formulaDisplay, support.format("CO2 = %s - %s = %s", carbonateTotal, lkdLoss, total), trace.appliedFactors(), trace.logs(), trace.defaultApplied());
    }

    private LimeTier2LineCalculation resolveTier2LineCalculation(Map<String, Map<Integer, Double>> lineValues,
                                                                 Map<String, Map<Integer, String>> lineTextValues,
                                                                 Map<String, Double> factorValues,
                                                                 Integer lineNo) {
        double mass = support.lineNumber(lineValues, "MLI", lineNo);
        double caoContent = support.ratio(support.lineNumber(lineValues, "CAO_CONTENT", lineNo));
        double caoMgoContent = support.ratio(support.lineNumber(lineValues, "CAO_MGO_CONTENT", lineNo));
        double combinedContent = caoMgoContent > 0d ? caoMgoContent : 0d;
        double md = support.lineNumber(lineValues, "MD", lineNo);
        double cd = support.ratio(support.lineNumber(lineValues, "CD", lineNo));
        double fd = support.ratio(support.lineNumber(lineValues, "FD", lineNo));
        double x = support.ratio(support.lineNumber(lineValues, "X", lineNo));
        double y = support.ratio(support.lineNumber(lineValues, "Y", lineNo));
        String limeType = support.lineText(lineTextValues, "LIME_TYPE", lineNo);

        ResolvedFactor factor = support.resolveLimeTier2Factor(limeType, caoContent, combinedContent, factorValues, lineNo);
        ResolvedFactor cfLkd = support.resolveLimeTier2CkdFactor(md, cd, fd, mass, factorValues);
        ResolvedFactor hydrationCorrection = support.resolveLimeTier2HydrationCorrection(
                support.lineText(lineTextValues, "HYDRATED_LIME_PRODUCTION_YN", lineNo),
                x,
                y,
                factorValues);

        return new LimeTier2LineCalculation(
                mass,
                factor,
                cfLkd,
                hydrationCorrection,
                mass * factor.value * cfLkd.value * hydrationCorrection.value,
                support.joinNoteParts(
                        support.factorSourceNote(factor, EmissionCalculationSupport.LIME_TIER2_FACTOR_POLICY),
                        support.format("LIME_TYPE=%s, CaO=%s, CaO·MgO=%s", limeType, caoContent, combinedContent)
                ),
                support.joinNoteParts(
                        support.factorSourceNote(cfLkd, EmissionCalculationSupport.LIME_TIER2_CFKLD_POLICY),
                        cfLkd.source == FactorSource.DERIVED ? support.format("Md=%s, Cd=%s, Fd=%s", md, cd, fd) : null
                ),
                support.joinNoteParts(
                        support.factorSourceNote(hydrationCorrection, EmissionCalculationSupport.LIME_TIER2_HYDRATION_POLICY),
                        hydrationCorrection.source == FactorSource.CALCULATED && (x > 0d || y > 0d) ? support.format("x=%s, y=%s", x, y) : null
                )
        );
    }
}
