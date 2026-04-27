package egovframework.com.feature.admin.service.impl;

@FunctionalInterface
interface CalculationExecutor {
    CalculationResult execute(CalculationContext context);
}
