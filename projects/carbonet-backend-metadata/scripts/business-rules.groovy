/**
 * Business Rules Script
 * 핵심 비즈니스 로직을 이 파일에 정의하면 빌드 없이 수정 가능
 * 복잡한 계산, 워크플로우, 조건부 로직 등을 여기에 작성
 */
package carbonet.scripts

class BusinessRules {
    
    /**
     * Emission 계산 로직
     */
    static Map calculateEmission(Map input) {
        def emissionType = input.emissionType
        def amount = input.amount as Double
        def country = input.country ?: 'KR'
        def year = input.year ?: 2024
        
        def factor = getEmissionFactor(emissionType, country, year)
        def emission = amount * factor
        
        return [
            emissionType: emissionType,
            amount: amount,
            factor: factor,
            result: emission,
            unit: 'kgCO2e',
            country: country,
            year: year
        ]
    }
    
    /**
     * 배출계수 조회 (메타데이터 기반)
     */
    static Double getEmissionFactor(String type, String country, int year) {
        // 실제로는 DB나 메타데이터에서 조회
        def factors = [
            'electricity': [KR: 0.459, US: 0.387, CN: 0.527, EU: 0.276],
            'gas': [KR: 2.24, US: 1.93, CN: 2.06, EU: 2.01],
            'oil': [KR: 2.68, US: 2.52, CN: 2.74, EU: 2.58],
            'coal': [KR: 2.86, US: 2.42, CN: 2.66, EU: 2.38]
        ]
        
        def countryFactors = factors[type] ?: factors['electricity']
        return countryFactors[country] ?: countryFactors['KR']
    }
    
    /**
     * Approval 워크플로우 로직
     */
    static Map evaluateApprovalWorkflow(Map request) {
        def amount = request.amount as Double
        def department = request.department
        def requester = request.requester
        
        def workflow = determineWorkflow(amount, department)
        def nextApprovers = determineNextApprovers(workflow, department)
        
        return [
            workflowType: workflow,
            currentStep: 1,
            totalSteps: workflow == 'simple' ? 2 : 4,
            nextApprovers: nextApprovers,
            estimatedCompletionDays: workflow == 'simple' ? 1 : 5
        ]
    }
    
    /**
     * 워크플로우 유형 결정
     */
    static String determineWorkflow(Double amount, String department) {
        if (amount < 1000000) {
            return 'simple'
        } else if (amount < 10000000) {
            return 'medium'
        } else {
            return 'complex'
        }
    }
    
    /**
     * 승인자 결정
     */
    static List determineNextApprovers(String workflow, String department) {
        def managers = [
            'IT': ['manager_it_1', 'manager_it_2'],
            'HR': ['manager_hr_1', 'manager_hr_2'],
            'FIN': ['manager_fin_1', 'manager_fin_2'],
            'default': ['manager_general_1']
        ]
        
        return managers[department] ?: managers['default']
    }
    
    /**
     * 데이터 검증 로직
     */
    static ValidationResult validateBusinessData(Map data, String dataType) {
        def result = new ValidationResult()
        
        switch (dataType) {
            case 'emission':
                validateEmissionData(data, result)
                break
            case 'approval':
                validateApprovalData(data, result)
                break
            case 'user':
                validateUserData(data, result)
                break
        }
        
        return result
    }
    
    private static void validateEmissionData(Map data, ValidationResult result) {
        if (!data.emissionType) {
            result.addError('emissionType', 'Emission type is required')
        }
        if (!data.amount || data.amount <= 0) {
            result.addError('amount', 'Amount must be positive')
        }
    }
    
    private static void validateApprovalData(Map data, ValidationResult result) {
        if (!data.requester) {
            result.addError('requester', 'Requester is required')
        }
        if (!data.amount || data.amount < 0) {
            result.addError('amount', 'Amount cannot be negative')
        }
    }
    
    private static void validateUserData(Map data, ValidationResult result) {
        if (!data.userId) {
            result.addError('userId', 'User ID is required')
        }
        if (data.email && !data.email.contains('@')) {
            result.addError('email', 'Invalid email format')
        }
    }
}

class ValidationResult {
    boolean valid = true
    Map<String, List<String>> errors = [:]
    
    void addError(String field, String message) {
        valid = false
        errors.computeIfAbsent(field, { [] }) << message
    }
    
    List<String> getAllErrors() {
        errors.values().flatten()
    }
}
