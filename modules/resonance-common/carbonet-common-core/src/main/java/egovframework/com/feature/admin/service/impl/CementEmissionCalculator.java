package egovframework.com.feature.admin.service.impl;

import java.util.Map;
import java.util.Set;

final class CementEmissionCalculator {
    private final EmissionCalculationSupport support;
    private final double cementTier1EfclcDefault;
    private final double cementEfcDefault;
    private final double cementEfclDefault;
    private final double cementCfckdDefault;

    CementEmissionCalculator(EmissionCalculationSupport support,
                             double cementTier1EfclcDefault,
                             double cementEfcDefault,
                             double cementEfclDefault,
                             double cementCfckdDefault) {
        this.support = support;
        this.cementTier1EfclcDefault = cementTier1EfclcDefault;
        this.cementEfcDefault = cementEfcDefault;
        this.cementEfclDefault = cementEfclDefault;
        this.cementCfckdDefault = cementCfckdDefault;
    }

    CalculationResult calculateTier1(CalculationContext context) {
        double im = support.number(context.scalarValues, "IM");
        double ex = support.number(context.scalarValues, "EX");
        CalculationTrace trace = new CalculationTrace();
        AppliedFactor efclc = support.applyScalarFactor(trace, "EFCLC", support.resolveScalarFactor(context.scalarValues, context.factorValues, "EFCLC", cementTier1EfclcDefault), null, EmissionCalculationSupport.GENERIC_FACTOR_POLICY);
        double clinkerProductionTotal = calculateClinkerProductionTotal(context.scalarValues, context.lineValues, trace);
        double clinkerMass = clinkerProductionTotal - im + ex;
        double total = clinkerMass * efclc.factor.value;
        trace.addLog("클링커 생산량", null, "Σ(Mci × Ccli) - Im + Ex", support.format("%s - %s + %s", clinkerProductionTotal, im, ex), clinkerMass, null);
        trace.addLog("CO2 배출량", null, "[클링커 생산량] × EFclc", support.format("%s × %s", clinkerMass, efclc.factor.value), total, efclc.note);
        return new CalculationResult(total, context.definition.formulaSummary, context.definition.formulaDisplay, support.format("CO2 = [%s - %s + %s] × %s = %s", clinkerProductionTotal, im, ex, efclc.factor.value, total), trace.appliedFactors(), trace.logs(), trace.defaultApplied());
    }

    CalculationResult calculateTier2(CalculationContext context) {
        double mcl = support.number(context.scalarValues, "MCL");
        double md = support.number(context.scalarValues, "MD");
        double cd = support.ratio(support.number(context.scalarValues, "CD"));
        double fd = support.ratio(support.number(context.scalarValues, "FD"));
        CalculationTrace trace = new CalculationTrace();
        AppliedFactor efc = support.applyScalarFactor(trace, "EFC", support.resolveScalarFactor(context.scalarValues, context.factorValues, "EFC", cementEfcDefault), null, EmissionCalculationSupport.GENERIC_FACTOR_POLICY);
        AppliedFactor efcl = support.applyScalarFactor(trace, "EFCL", support.resolveScalarFactor(context.scalarValues, context.factorValues, "EFCL", cementEfclDefault), null, EmissionCalculationSupport.GENERIC_FACTOR_POLICY);
        boolean canDeriveCfckd = mcl > 0d && md > 0d && cd > 0d && fd > 0d && efcl.factor.value > 0d;
        AppliedFactor cfckd = canDeriveCfckd
                ? support.applyScalarFactor(trace, "CFCKD", ResolvedFactor.derived(1d + (md / mcl) * cd * fd * (efc.factor.value / efcl.factor.value)), null, EmissionCalculationSupport.GENERIC_FACTOR_POLICY)
                : support.applyScalarFactor(trace, "CFCKD", support.resolveScalarFactor(context.scalarValues, context.factorValues, "CFCKD", cementCfckdDefault), null, EmissionCalculationSupport.GENERIC_FACTOR_POLICY);
        double total = mcl * efcl.factor.value * cfckd.factor.value;
        trace.addLog("CFckd 산정", null, canDeriveCfckd ? "1 + (Md / Mcl) × Cd × Fd × (EFc / EFcl)" : "기본/저장 계수 사용", canDeriveCfckd ? support.format("1 + (%s / %s) × %s × %s × (%s / %s)", md, mcl, cd, fd, efc.factor.value, efcl.factor.value) : support.format("%s", cfckd.factor.value), cfckd.factor.value, canDeriveCfckd ? cfckd.note : "유도식 입력 부족으로 기본값 또는 저장 계수 사용");
        trace.addLog("CO2 배출량", null, "Mcl × EFcl × CFckd", support.format("%s × %s × %s", mcl, efcl.factor.value, cfckd.factor.value), total, support.joinNoteParts(efcl.note, cfckd.note));
        return new CalculationResult(total, context.definition.formulaSummary, context.definition.formulaDisplay, support.format("CO2 = %s × %s × %s = %s", mcl, efcl.factor.value, cfckd.factor.value, total), trace.appliedFactors(), trace.logs(), trace.defaultApplied());
    }

    CalculationResult calculateTier3(CalculationContext context) {
        Set<Integer> carbonateLines = support.lineIndexes(context.lineValues, "MI", "FI", "EFI");
        Set<Integer> rawMaterialLines = support.lineIndexes(context.lineValues, "RAW_MATERIAL_CARBONATE_TYPE", "MK", "XK", "EFK");
        double carbonateTotal = 0d;
        CalculationTrace trace = new CalculationTrace();
        for (Integer lineNo : carbonateLines) {
            AppliedFactor carbonateFactor = support.applyResolvedFactor(
                    trace,
                    "EFI[" + lineNo + "]",
                    support.resolveCarbonateLineFactor(context.lineValues, context.lineTextValues, context.factorValues, "EFI", "CARBONATE_TYPE", lineNo, "cement-carbonate-" + lineNo),
                    support.lineText(context.lineTextValues, "CARBONATE_TYPE", lineNo),
                    EmissionCalculationSupport.CARBONATE_FACTOR_POLICY
            );
            double mass = support.lineNumber(context.lineValues, "MI", lineNo);
            double ratioValue = support.ratio(support.lineNumber(context.lineValues, "FI", lineNo));
            double lineTotal = mass * ratioValue * carbonateFactor.factor.value;
            carbonateTotal += lineTotal;
            trace.addLog("탄산염 합계", lineNo, "Mi × Fi × EFi", support.format("%s × %s × %s", mass, ratioValue, carbonateFactor.factor.value), lineTotal, carbonateFactor.note);
        }

        double md = support.number(context.scalarValues, "MD");
        double cd = support.ratio(support.number(context.scalarValues, "CD"));
        double fd = support.ratio(support.number(context.scalarValues, "FD"));
        AppliedFactor efd = support.applyScalarFactor(trace, "EFD", support.resolveCarbonateScalarFactor(context.scalarValues, context.scalarTexts, context.factorValues, "EFD", "LKD_CARBONATE_TYPE", cementEfcDefault), context.scalarTexts.get("LKD_CARBONATE_TYPE"), EmissionCalculationSupport.CARBONATE_FACTOR_POLICY);
        double ckdLoss = md * cd * (1d - fd) * efd.factor.value;
        trace.addLog("CKD 보정", null, "Md × Cd × (1 - Fd) × EFd", support.format("%s × %s × (1 - %s) × %s", md, cd, fd, efd.factor.value), ckdLoss, efd.note);

        double rawMaterialTotal = 0d;
        for (Integer lineNo : rawMaterialLines) {
            AppliedFactor factor = support.applyResolvedFactor(
                    trace,
                    "EFK[" + lineNo + "]",
                    support.resolveCarbonateLineFactor(context.lineValues, context.lineTextValues, context.factorValues, "EFK", "RAW_MATERIAL_CARBONATE_TYPE", lineNo, "cement-raw-material-" + lineNo),
                    support.lineText(context.lineTextValues, "RAW_MATERIAL_CARBONATE_TYPE", lineNo),
                    EmissionCalculationSupport.CARBONATE_FACTOR_POLICY
            );
            double mass = support.lineNumber(context.lineValues, "MK", lineNo);
            double ratioValue = support.ratio(support.lineNumber(context.lineValues, "XK", lineNo));
            double lineTotal = mass * ratioValue * factor.factor.value;
            rawMaterialTotal += lineTotal;
            trace.addLog("원료 보정 합계", lineNo, "Mk × Xk × EFk", support.format("%s × %s × %s", mass, ratioValue, factor.factor.value), lineTotal, factor.note);
        }

        double total = carbonateTotal - ckdLoss + rawMaterialTotal;
        trace.addLog("최종 합계", null, "Σ(탄산염) - CKD 보정 + Σ(원료 보정)", support.format("%s - %s + %s", carbonateTotal, ckdLoss, rawMaterialTotal), total, null);
        return new CalculationResult(total, context.definition.formulaSummary, context.definition.formulaDisplay, support.format("CO2 = %s - %s + %s = %s", carbonateTotal, ckdLoss, rawMaterialTotal, total), trace.appliedFactors(), trace.logs(), trace.defaultApplied());
    }

    private double calculateClinkerProductionTotal(Map<String, Double> scalarValues,
                                                   Map<String, Map<Integer, Double>> lineValues,
                                                   CalculationTrace trace) {
        support.requireMatchingLineSet(lineValues, "시멘트 Tier 1", "MCI", "CCLI");
        Set<Integer> cementLines = support.lineIndexes(lineValues, "MCI", "CCLI");
        if (cementLines.isEmpty()) {
            double mci = support.number(scalarValues, "MCI");
            double ccli = support.ratio(support.number(scalarValues, "CCLI"));
            double clinkerProductionTotal = mci * ccli;
            trace.addLog("시멘트 합계", 1, "Mci × Ccli", support.format("%s × %s", mci, ccli), clinkerProductionTotal, "반복 입력이 없어 단일 입력을 line 1로 계산");
            return clinkerProductionTotal;
        }
        double clinkerProductionTotal = 0d;
        for (Integer lineNo : cementLines) {
            double mci = support.lineNumber(lineValues, "MCI", lineNo);
            double ccli = support.ratio(support.lineNumber(lineValues, "CCLI", lineNo));
            double lineTotal = mci * ccli;
            clinkerProductionTotal += lineTotal;
            trace.addLog("시멘트 합계", lineNo, "Mci × Ccli", support.format("%s × %s", mci, ccli), lineTotal, null);
        }
        return clinkerProductionTotal;
    }
}
