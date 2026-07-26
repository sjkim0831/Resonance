"""Parse and normalize contract data"""

import json
import re
from pathlib import Path
from typing import List, Dict, Any, Tuple

from builder.common.types import ScreenContract, ApiContract, FieldContract, SectionContract, FIELD_TYPES, HTTP_METHODS
from builder.common.base import LayerBase, LayerResult

class ContractParser(LayerBase):
    """Layer 02: Parse and normalize contract data"""
    
    def __init__(self):
        super().__init__(2, "Contract Parser", "Parse and normalize contract data")
    
    def execute(self, context: Dict, input_data: List[ScreenContract]) -> Tuple[bool, List[ScreenContract], LayerResult]:
        """Parse and normalize contracts"""
        self.log("Starting contract parsing")
        
        parsed = []
        errors = []
        
        for contract in input_data:
            try:
                normalized = self._normalize_contract(contract)
                if normalized:
                    parsed.append(normalized)
            except Exception as e:
                errors.append({'contract_id': contract.contract_id, 'error': str(e)})
                self.log_error(contract.contract_id, str(e))
        
        # Save parsed contracts
        output_path = Path("/tmp/builder_output/02_parse/parsed_contracts.json")
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        parsed_data = [
            {
                'contract_id': c.contract_id,
                'route_path': c.route_path,
                'screen_name': c.screen_name,
                'normalized': True
            }
            for c in parsed
        ]
        
        with open(output_path, 'w') as f:
            json.dump({'parsed': parsed_data, 'errors': errors}, f, ensure_ascii=False, indent=2)
        
        result = self.create_result(
            len(errors) == 0, 0.1,
            processed_count=len(parsed),
            failed_count=len(errors),
            artifacts={'output': str(output_path)}
        )
        
        self.log(f"Parsed {len(parsed)} contracts, {len(errors)} errors")
        return len(errors) == 0, parsed, result
    
    def _normalize_contract(self, contract: ScreenContract) -> Optional[ScreenContract]:
        """Normalize a contract"""
        
        # Validate route path
        if not contract.route_path:
            self.log_warning(contract.contract_id, "Missing route_path, using default")
            contract.route_path = f"/screen/{contract.contract_id}"
        
        # Ensure route starts with /
        if not contract.route_path.startswith('/'):
            contract.route_path = '/' + contract.route_path
        
        # Normalize screen name
        contract.screen_name = self._normalize_screen_name(contract.screen_name)
        
        # Normalize API contracts
        contract.api_contract = [self._normalize_api(a) for a in contract.api_contract]
        
        # Normalize field contracts
        contract.field_contract = [self._normalize_field(f) for f in contract.field_contract]
        
        # Normalize section contracts
        contract.section_contract = self._normalize_sections(contract.section_contract)
        
        return contract
    
    def _normalize_screen_name(self, name: str) -> str:
        """Normalize screen name - remove special chars, keep Korean"""
        if not name:
            return "Untitled"
        
        # Remove special characters except Korean/alphanumeric/space
        cleaned = re.sub(r'[^\w\s\uAC00-\uD7A3]', ' ', name)
        # Collapse multiple spaces
        cleaned = re.sub(r'\s+', ' ', cleaned).strip()
        
        return cleaned if cleaned else "Untitled"
    
    def _normalize_api(self, api: ApiContract) -> ApiContract:
        """Normalize API contract"""
        api.method = api.method.upper()
        if api.method not in HTTP_METHODS:
            api.method = 'GET'  # Default to GET
        
        if not api.path.startswith('/'):
            api.path = '/' + api.path
        
        if not api.code:
            api.code = api.path.split('/')[-1] or 'api'
        
        return api
    
    def _normalize_field(self, field: FieldContract) -> FieldContract:
        """Normalize field contract"""
        # Validate data type
        if field.data_type not in FIELD_TYPES:
            self.log_warning(field.field_code, f"Unknown type {field.data_type}, using TEXT")
            field.data_type = 'TEXT'
        
        # Normalize field code (no spaces, lowercase for consistency)
        field.field_code = re.sub(r'\s+', '_', field.field_code).lower()
        
        # Ensure options are properly formatted for selection types
        if field.data_type in ['SELECT', 'CODE', 'ENUM', 'RADIO']:
            if not field.options:
                field.options = []
        
        return field
    
    def _normalize_sections(self, sections: List[SectionContract]) -> List[SectionContract]:
        """Normalize sections"""
        if not sections:
            return [SectionContract(section_code='default', section_name='Main', order=1)]
        
        # Ensure each section has required fields
        for i, section in enumerate(sections):
            if not section.section_code:
                section.section_code = f'section_{i}'
            if not section.section_name:
                section.section_name = f'Section {i+1}'
            if section.order == 0:
                section.order = i + 1
        
        return sections
