package egovframework.com.feature.admin.service.impl;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;

final class VariableUiDefinition {
    final Map<String, String> displayNames;
    final Map<String, String> displayCodes;
    final Map<String, String> uiHints;
    final Set<String> derivedCodes;
    final Set<String> supplementalCodes;
    final Map<String, String> repeatGroupKeys;
    final Map<String, VariableSectionDefinition> sections;
    final Map<String, String> visibleWhenRules;
    final Map<String, String> disabledWhenRules;

    VariableUiDefinition(Map<String, String> displayNames,
                         Map<String, String> displayCodes,
                         Map<String, String> uiHints,
                         Set<String> derivedCodes,
                         Set<String> supplementalCodes,
                         Map<String, String> repeatGroupKeys,
                         Map<String, VariableSectionDefinition> sections,
                         Map<String, String> visibleWhenRules,
                         Map<String, String> disabledWhenRules) {
        this.displayNames = displayNames;
        this.displayCodes = displayCodes;
        this.uiHints = uiHints;
        this.derivedCodes = derivedCodes;
        this.supplementalCodes = supplementalCodes;
        this.repeatGroupKeys = repeatGroupKeys;
        this.sections = sections;
        this.visibleWhenRules = visibleWhenRules;
        this.disabledWhenRules = disabledWhenRules;
    }

    static Builder builder() {
        return new Builder();
    }

    static VariableUiDefinition empty() {
        return builder().build();
    }

    String displayName(String varCode) {
        return displayNames.getOrDefault(varCode, "");
    }

    String displayCode(String varCode) {
        return displayCodes.getOrDefault(varCode, "");
    }

    String uiHint(String varCode) {
        return uiHints.getOrDefault(varCode, "");
    }

    boolean isDerived(String varCode) {
        return derivedCodes.contains(varCode);
    }

    boolean isSupplemental(String varCode) {
        return supplementalCodes.contains(varCode);
    }

    String repeatGroupKey(String varCode) {
        return repeatGroupKeys.getOrDefault(varCode, "");
    }

    VariableSectionDefinition section(String varCode) {
        return sections.get(varCode);
    }

    String visibleWhen(String varCode) {
        return visibleWhenRules.getOrDefault(varCode, "");
    }

    String disabledWhen(String varCode) {
        return disabledWhenRules.getOrDefault(varCode, "");
    }

    static final class Builder {
        private final Map<String, String> displayNames = new LinkedHashMap<>();
        private final Map<String, String> displayCodes = new LinkedHashMap<>();
        private final Map<String, String> uiHints = new LinkedHashMap<>();
        private final Set<String> derivedCodes = new LinkedHashSet<>();
        private final Set<String> supplementalCodes = new LinkedHashSet<>();
        private final Map<String, String> repeatGroupKeys = new LinkedHashMap<>();
        private final Map<String, VariableSectionDefinition> sections = new LinkedHashMap<>();
        private final Map<String, String> visibleWhenRules = new LinkedHashMap<>();
        private final Map<String, String> disabledWhenRules = new LinkedHashMap<>();

        Builder displayName(String varCode, String label) {
            displayNames.put(varCode, label);
            return this;
        }

        Builder displayCode(String varCode, String code) {
            displayCodes.put(varCode, code);
            return this;
        }

        Builder uiHint(String varCode, String hint) {
            uiHints.put(varCode, hint);
            return this;
        }

        Builder derived(String... varCodes) {
            Collections.addAll(derivedCodes, varCodes);
            return this;
        }

        Builder supplemental(String... varCodes) {
            Collections.addAll(supplementalCodes, varCodes);
            return this;
        }

        Builder repeatGroup(String groupKey, String... varCodes) {
            for (String varCode : varCodes) {
                repeatGroupKeys.put(varCode, groupKey);
            }
            return this;
        }

        Builder groupedSection(String groupKey, VariableSectionDefinition section, String... varCodes) {
            return repeatGroup(groupKey, varCodes).section(section, varCodes);
        }

        Builder section(VariableSectionDefinition section, String... varCodes) {
            for (String varCode : varCodes) {
                sections.put(varCode, section);
            }
            return this;
        }

        Builder visibleWhen(String varCode, String rule) {
            visibleWhenRules.put(varCode, rule);
            return this;
        }

        Builder disabledWhen(String varCode, String rule) {
            disabledWhenRules.put(varCode, rule);
            return this;
        }

        VariableUiDefinition build() {
            return new VariableUiDefinition(
                    new LinkedHashMap<>(displayNames),
                    new LinkedHashMap<>(displayCodes),
                    new LinkedHashMap<>(uiHints),
                    new LinkedHashSet<>(derivedCodes),
                    new LinkedHashSet<>(supplementalCodes),
                    new LinkedHashMap<>(repeatGroupKeys),
                    new LinkedHashMap<>(sections),
                    new LinkedHashMap<>(visibleWhenRules),
                    new LinkedHashMap<>(disabledWhenRules)
            );
        }
    }
}
