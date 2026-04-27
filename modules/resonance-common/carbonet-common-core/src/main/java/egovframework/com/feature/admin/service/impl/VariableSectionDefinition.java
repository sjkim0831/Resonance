package egovframework.com.feature.admin.service.impl;

final class VariableSectionDefinition {
    final String id;
    final int order;
    final String title;
    final String description;
    final String formula;
    final String previewType;
    final String relatedFactorCodes;

    VariableSectionDefinition(String id, int order, String title, String description, String formula, String previewType, String relatedFactorCodes) {
        this.id = id;
        this.order = order;
        this.title = title;
        this.description = description;
        this.formula = formula;
        this.previewType = previewType;
        this.relatedFactorCodes = relatedFactorCodes;
    }
}
