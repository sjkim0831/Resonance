"""Validate contract integrity and completeness"""

import json
from pathlib import Path
from typing import List, Dict, Any, Tuple

from builder.common.types import ScreenContract, FIELD_TYPES, HTTP_METHODS
from builder.common.base import LayerBase, LayerResult

class ContractValidator(LayerBase):
    """Layer 03: Validate contracts for correctness
    
    Note: This validator logs issues but does NOT fail the layer.
    Data quality issues (duplicate routes, missing options) are reported
    but processing continues. Use strict=True to fail on any issue.
    """
    
    def __init__(self, strict: bool = False):
        super().__init__(3, "Validation", "Validate contract integrity")
        self.strict = strict
        self.route_cache = set()  # For duplicate detection
    
    def execute(self, context: Dict, input_data: List[ScreenContract]) -> Tuple[bool, List[ScreenContract], LayerResult]:
        """Validate contracts"""
        self.log("Starting validation")
        self.route_cache.clear()
        
        valid = []
        error_count = 0
        warning_count = 0
        
        for idx, contract in enumerate(input_data):
            is_valid, errors, warnings = self._validate_contract(contract)
            
            if errors:
                error_count += len(errors)
                for err in errors:
                    self.log_error(contract.contract_id, err.get('message', str(err)))
            
            for warn in warnings:
                warning_count += 1
                self.log_warning(contract.contract_id, warn)
            
            # Invalid contracts must not reach code generation in strict mode.
            if is_valid or not self.strict:
                valid.append(contract)
        
        # Save validation report
        report_path = Path("/tmp/builder_output/03_validate/validation_report.json")
        report_path.parent.mkdir(parents=True, exist_ok=True)
        
        report = {
            'timestamp': '',
            'total': len(input_data),
            'valid': len(valid),
            'errors': error_count,
            'warnings': warning_count,
            'error_list': [
                {'contract_id': e.get('item_id', 'N/A'), 'error': e.get('error', '')}
                for e in self.errors
            ]
        }
        
        with open(report_path, 'w') as f:
            json.dump(report, f, ensure_ascii=False, indent=2)
        
        # Only fail if strict=True AND there are actual errors
        success = (error_count == 0) if self.strict else True
        
        result = self.create_result(
            success, 0.1,
            processed_count=len(valid),
            failed_count=error_count,
            warning=str(warning_count) + " warnings" if warning_count else ""
        )
        
        self.log("Validated: " + str(len(valid)) + " contracts, " + str(error_count) + " errors, " + str(warning_count) + " warnings")
        return success, valid, result
    
    def _validate_contract(self, contract: ScreenContract) -> Tuple[bool, List[Dict], List[str]]:
        """Validate a single contract"""
        errors = []
        warnings = []
        
        # Required fields
        if not contract.route_path:
            errors.append({'type': 'ERROR', 'message': 'Missing route_path'})
        elif not contract.route_path.startswith('/'):
            errors.append({'type': 'ERROR', 'message': 'route_path must start with /'})
        
        if not contract.screen_name:
            warnings.append('Missing screen_name')
        
        # Duplicate route check (only error, not blocking)
        if contract.route_path in self.route_cache:
            errors.append({'type': 'ERROR', 'message': 'Duplicate route: ' + contract.route_path})
        elif contract.route_path:
            self.route_cache.add(contract.route_path)
        
        # API validation
        for api in contract.api_contract:
            api_errors = self._validate_api(api)
            errors.extend(api_errors)
        
        # Field validation
        field_codes = set()
        for field in contract.field_contract:
            field_errors, field_warnings = self._validate_field(field)
            errors.extend(field_errors)
            warnings.extend(field_warnings)
            
            # Duplicate field code check
            if field.field_code in field_codes:
                warnings.append('Duplicate field code: ' + field.field_code)
            field_codes.add(field.field_code)
        
        return len(errors) == 0, errors, warnings
    
    def _validate_api(self, api) -> List[Dict]:
        """Validate API definition"""
        errors = []
        
        if api.method not in HTTP_METHODS:
            errors.append({'type': 'ERROR', 'message': 'Invalid HTTP method: ' + api.method})
        
        if not api.path:
            errors.append({'type': 'ERROR', 'message': 'Missing API path'})
        elif not api.path.startswith('/'):
            errors.append({'type': 'WARNING', 'message': 'API path should start with /: ' + api.path})
        
        return errors
    
    def _validate_field(self, field) -> Tuple[List[Dict], List[str]]:
        """Validate field definition"""
        errors = []
        warnings = []
        
        if not field.field_code:
            errors.append({'type': 'ERROR', 'message': 'Missing fieldCode'})
        
        if field.data_type not in FIELD_TYPES:
            errors.append({'type': 'WARNING', 'message': 'Unknown field type: ' + field.data_type})
        
        # Selection types need options
        if field.data_type in ['SELECT', 'CODE', 'ENUM', 'RADIO', 'AUTOCOMPLETE']:
            if not field.options:
                warnings.append(field.field_code + ': Selection type without options')
        
        return errors, warnings
