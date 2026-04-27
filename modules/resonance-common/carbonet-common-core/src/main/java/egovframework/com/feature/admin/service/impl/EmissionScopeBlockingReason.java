package egovframework.com.feature.admin.service.impl;

final class EmissionScopeBlockingReason {
    final String code;
    final String message;
    final boolean blocking;

    EmissionScopeBlockingReason(String code, String message, boolean blocking) {
        this.code = code;
        this.message = message;
        this.blocking = blocking;
    }
}
