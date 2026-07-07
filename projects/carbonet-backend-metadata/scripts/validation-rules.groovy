/**
 * Validation Rules Script
 * 입력 검증 로직 - 빌드 없이 수정 가능
 */
package carbonet.scripts

class ValidationRules {
    
    static ValidationResult validate(Map entity, Map rules) {
        def result = new ValidationResult()
        
        rules.fieldRules.each { field, fieldRules ->
            def value = entity[field]
            fieldRules.each { rule ->
                def error = applyRule(field, value, rule)
                if (error) {
                    result.addError(field, error)
                }
            }
        }
        
        result.valid = result.errors.isEmpty()
        return result
    }
    
    private static String applyRule(String field, value, Map rule) {
        switch (rule.type) {
            case 'required':
                if (value == null || value.toString().trim().isEmpty()) {
                    return "${field}는 필수 입력 항목입니다"
                }
                break
            case 'minLength':
                if (value && value.toString().length() < rule.value) {
                    return "${field}는 최소 ${rule.value}자 이상이어야 합니다"
                }
                break
            case 'maxLength':
                if (value && value.toString().length() > rule.value) {
                    return "${field}는 최대 ${rule.value}자까지 입력 가능합니다"
                }
                break
            case 'pattern':
                if (value && !(value.toString() ==~ rule.value)) {
                    return "${field}의 형식이 올바르지 않습니다"
                }
                break
            case 'range':
                def num = value as Number
                if (num != null) {
                    if (rule.min != null && num < rule.min) {
                        return "${field}는 ${rule.min} 이상이어야 합니다"
                    }
                    if (rule.max != null && num > rule.max) {
                        return "${field}는 ${rule.max} 이하여야 합니다"
                    }
                }
                break
        }
        return null
    }
}

class ValidationResult {
    boolean valid = true
    Map<String, List<String>> errors = [:]
    
    void addError(String field, String message) {
        errors.computeIfAbsent(field, { [] }) << message
    }
    
    List<String> getAllErrors() {
        errors.values().flatten()
    }
}
