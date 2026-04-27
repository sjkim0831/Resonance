package egovframework.com.feature.admin.service.impl;

final class ResolvedFactor {
    final double value;
    final boolean defaultApplied;
    final FactorSource source;

    ResolvedFactor(double value, boolean defaultApplied, FactorSource source) {
        this.value = value;
        this.defaultApplied = defaultApplied;
        this.source = source;
    }

    static ResolvedFactor manual(double value) {
        return new ResolvedFactor(value, false, FactorSource.MANUAL);
    }

    static ResolvedFactor stored(double value) {
        return new ResolvedFactor(value, false, FactorSource.STORED);
    }

    static ResolvedFactor mapped(double value) {
        return new ResolvedFactor(value, true, FactorSource.MAPPED);
    }

    static ResolvedFactor fallback(double value) {
        return new ResolvedFactor(value, true, FactorSource.FALLBACK);
    }

    static ResolvedFactor derived(double value) {
        return new ResolvedFactor(value, false, FactorSource.DERIVED);
    }

    static ResolvedFactor calculated(double value) {
        return new ResolvedFactor(value, false, FactorSource.CALCULATED);
    }

    static ResolvedFactor combined(double value, boolean defaultApplied, FactorSource source) {
        return new ResolvedFactor(value, defaultApplied, source);
    }
}
