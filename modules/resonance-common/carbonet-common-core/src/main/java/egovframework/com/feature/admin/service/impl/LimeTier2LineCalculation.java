package egovframework.com.feature.admin.service.impl;

final class LimeTier2LineCalculation {
    final double mass;
    final ResolvedFactor factor;
    final ResolvedFactor cfLkd;
    final ResolvedFactor hydrationCorrection;
    final double lineTotal;
    final String factorNote;
    final String cfLkdNote;
    final String hydrationCorrectionNote;

    LimeTier2LineCalculation(double mass,
                             ResolvedFactor factor,
                             ResolvedFactor cfLkd,
                             ResolvedFactor hydrationCorrection,
                             double lineTotal,
                             String factorNote,
                             String cfLkdNote,
                             String hydrationCorrectionNote) {
        this.mass = mass;
        this.factor = factor;
        this.cfLkd = cfLkd;
        this.hydrationCorrection = hydrationCorrection;
        this.lineTotal = lineTotal;
        this.factorNote = factorNote;
        this.cfLkdNote = cfLkdNote;
        this.hydrationCorrectionNote = hydrationCorrectionNote;
    }
}
