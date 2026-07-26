"""Validate contracts for correctness and completeness"""

import json
from pathlib import Path
from typing import Dict, List, Tuple

# Supported field types
SUPPORTED_FIELD_TYPES = [
    'TEXT', 'NUMBER', 'DATE', 'DATETIME', 'SELECT', 'CHECKBOX', 'SWITCH',
    'RADIO', 'AUTOCOMPLETE', 'SLIDER', 'FILE', 'IMAGE', 'EMAIL', 'PASSWORD',
    'PHONE', 'TEXTAREA', 'CODE', 'ENUM', 'HIDDEN', 'CALCULATED', 'ADDRESS'
]

# Supported HTTP methods
SUPPORTED_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']

class ContractValidator:
    """Validate contract integrity"""
    
    def __init__(self, output_dir: Path):
        self.output_dir = output_dir
        self.errors: List[Dict] = []
        self.warnings: List[Dict] = []
    
    def validate_all(self, contracts: List[Dict]) -> Tuple[List[Dict], List[Dict]]:
        """Validate all contracts, return (valid, invalid)"""
        valid = []
        invalid = []
        route_cache = set()
        
        for c in contracts:
            result = self._validate_contract(c, route_cache)
            if result['errors']:
                invalid.append(c)
                self.errors.extend(result['errors'])
            else:
                valid.append(c)
                self.warnings.extend(result.get('warnings', []))
            
            # Track routes for duplicate detection
            if c.get('route_path'):
                route_cache.add(c['route_path'])
        
        return valid, invalid
    
    def _validate_contract(self, contract: Dict, route_cache: set) -> Dict:
        """Validate single contract"""
        errors = []
        warnings = []
        cid = contract.get('contract_id', 'UNKNOWN')
        
        # Required fields check
        if not contract.get('route_path'):
            errors.append({'contract_id': cid, 'type': 'ERROR', 'field': 'route_path', 
                          'message': 'Missing route_path'})
        
        if not contract.get('screen_name'):
            warnings.append({'contract_id': cid, 'type': 'WARNING', 'field': 'screen_name',
                           'message': 'Missing screen_name, will use contract_id'})
        
        # Duplicate route check
        route = contract.get('route_path')
        if route and route in route_cache:
            errors.append({'contract_id': cid, 'type': 'ERROR', 'field': 'route_path',
                          'message': f'Duplicate route: {route}'})
        
        # API validation
        for i, api in enumerate(contract.get('api_contract', [])):
            api_errors = self._validate_api(api, cid, i)
            errors.extend(api_errors)
        
        # Field validation
        for field in contract.get('fields', []):
            field_errors = self._validate_field(field, cid)
            errors.extend(field_errors)
        
        return {'errors': errors, 'warnings': warnings}
    
    def _validate_api(self, api: Dict, cid: str, index: int) -> List[Dict]:
        """Validate API definition"""
        errors = []
        
        method = api.get('method', '').upper()
        if method not in SUPPORTED_METHODS:
            errors.append({
                'contract_id': cid, 'type': 'ERROR', 'field': f'api[{index}].method',
                'message': f'Unsupported HTTP method: {method}'
            })
        
        path = api.get('path', '')
        if not path:
            errors.append({
                'contract_id': cid, 'type': 'ERROR', 'field': f'api[{index}].path',
                'message': 'Missing API path'
            })
        elif not path.startswith('/'):
            errors.append({
                'contract_id': cid, 'type': 'WARNING', 'field': f'api[{index}].path',
                'message': f'Path should start with /: {path}'
            })
        
        return errors
    
    def _validate_field(self, field: Dict, cid: str) -> List[Dict]:
        """Validate field definition"""
        errors = []
        
        if not field.get('fieldCode'):
            errors.append({
                'contract_id': cid, 'type': 'ERROR', 'field': 'field.fieldCode',
                'message': 'Missing fieldCode'
            })
        
        dtype = field.get('dataType', 'TEXT').upper()
        if dtype and dtype not in SUPPORTED_FIELD_TYPES:
            errors.append({
                'contract_id': cid, 'type': 'WARNING', 'field': 'field.dataType',
                'message': f'Unsupported field type: {dtype}'
            })
        
        return errors
    
    def save_report(self, valid: List[Dict], invalid: List[Dict]) -> Path:
        """Save validation report"""
        report = {
            'generated_at': datetime.now().isoformat(),
            'summary': {
                'total': len(valid) + len(invalid),
                'valid': len(valid),
                'invalid': len(invalid),
                'error_count': len(self.errors),
                'warning_count': len(self.warnings)
            },
            'errors': self.errors[:100],  # Limit to first 100
            'warnings': self.warnings[:100]
        }
        
        path = self.output_dir / "validation_report.json"
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(report, f, ensure_ascii=False, indent=2, default=str)
        return path

from datetime import datetime
