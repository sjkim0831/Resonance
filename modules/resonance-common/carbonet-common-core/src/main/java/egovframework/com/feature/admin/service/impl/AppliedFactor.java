package egovframework.com.feature.admin.service.impl;

final class AppliedFactor {
    final ResolvedFactor factor;
    final String note;

    AppliedFactor(ResolvedFactor factor, String note) {
        this.factor = factor;
        this.note = note;
    }
}
