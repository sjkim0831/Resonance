package egovframework.com.feature.admin.service.impl;

final class FactorNotePolicy {
    final String manualMessage;
    final String mappedMessage;
    final String storedMessage;
    final String fallbackMessage;
    final String derivedMessage;
    final String calculatedMessage;

    FactorNotePolicy(String manualMessage,
                     String mappedMessage,
                     String storedMessage,
                     String fallbackMessage,
                     String derivedMessage,
                     String calculatedMessage) {
        this.manualMessage = manualMessage;
        this.mappedMessage = mappedMessage;
        this.storedMessage = storedMessage;
        this.fallbackMessage = fallbackMessage;
        this.derivedMessage = derivedMessage;
        this.calculatedMessage = calculatedMessage;
    }
}
