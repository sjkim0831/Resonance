"""Extract design/contract from database"""

import json
import subprocess
from pathlib import Path
from typing import List, Dict, Any, Optional
from datetime import datetime

from builder.common.types import ScreenContract, ApiContract, FieldContract, SectionContract, FIELD_TYPES, HTTP_METHODS
from builder.common.base import LayerBase, LayerResult

class DesignExtractor(LayerBase):
    """Layer 01: Extract design contracts from PostgreSQL"""
    
    def __init__(self, db_config: Dict = None):
        super().__init__(1, "Design Extraction", "Extract contracts from database")
        self.db_config = db_config or {
            'pod': 'postgres-patroni-1',
            'namespace': 'carbonet-prod',
            'database': 'carbonet'
        }
    
    def execute(self, context: Dict, input_data: Any) -> tuple[bool, List[ScreenContract], LayerResult]:
        """Extract contracts from DB"""
        self.log("Starting design extraction")
        
        contracts = self._extract_from_db()
        
        if not contracts:
            return False, [], self.create_result(False, 0.0, error="No contracts extracted")
        
        # Save to catalog
        catalog_path = Path("/tmp/builder_output/01_design/contracts_catalog.json")
        catalog_path.parent.mkdir(parents=True, exist_ok=True)
        
        catalog = {
            'extracted_at': datetime.now().isoformat(),
            'total': len(contracts),
            'contracts': [
                {
                    'id': c.contract_id,
                    'route': c.route_path,
                    'screen': c.screen_name,
                    'fields': c.get_field_count(),
                    'sections': c.get_section_count(),
                    'apis': c.get_api_count()
                }
                for c in contracts
            ]
        }
        
        with open(catalog_path, 'w') as f:
            json.dump(catalog, f, ensure_ascii=False, indent=2)
        
        duration = 0.1
        result = self.create_result(
            True, duration,
            files_created=1,
            processed_count=len(contracts),
            artifacts={'catalog': str(catalog_path)}
        )
        
        self.log(f"Extracted {len(contracts)} contracts")
        return True, contracts, result
    
    def _extract_from_db(self) -> List[ScreenContract]:
        """Extract contracts using row_to_json for safe Korean text handling"""
        
        sql = """SELECT row_to_json(c) FROM (
            SELECT c.contract_id, c.route_path, c.screen_name, c.process_code,
                   c.step_code, c.actor_code, c.audience,
                   c.business_purpose, c.entry_condition, c.exit_condition,
                   c.api_contract, c.state_contract, c.field_contract,
                   c.section_contract, c.command_contract, c.data_contract,
                   c.evidence_contract, c.responsive_contract,
                   c.accessibility_contract, c.security_contract,
                   ss.input_schema, ss.output_schema, ss.persistence_schema,
                   ss.handoff_schema, ss.context_keys,
                   jsonb_build_array(jsonb_build_object(
                       'actorCode', coalesce(nullif(c.actor_code, ''), 'USER'),
                       'scope', c.route_path,
                       'actions', coalesce(to_jsonb(c.command_contract), '[]'::jsonb)
                   )) AS permissions,
                   coalesce((
                       SELECT jsonb_agg(jsonb_build_object(
                           'caseCode', sc.case_code, 'name', sc.case_name,
                           'type', sc.case_type, 'preconditions', sc.preconditions,
                           'steps', sc.steps_json, 'assertions', sc.assertions_json,
                           'status', sc.case_status) ORDER BY sc.case_code)
                       FROM framework_simulation_case sc
                       WHERE sc.process_code = c.process_code
                   ), '[]'::jsonb) AS tests,
                   c.updated_at
            FROM framework_professional_screen_contract c
            LEFT JOIN framework_step_schema_set ss
              ON ss.process_code = c.process_code AND ss.step_code = c.step_code
            WHERE c.contract_status IN ('VERIFIED', 'DESIGN_COMPLETE')
            ORDER BY c.contract_id
        ) c"""
        
        cmd = [
            "kubectl", "exec", self.db_config['pod'],
            "-n", self.db_config['namespace'],
            "--", "psql", "-h", "127.0.0.1",
            "-U", "postgres", "-d", self.db_config['database'],
            "-t", "-A", "-c", sql
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
        
        if result.returncode != 0:
            self.log(f"DB command failed: {result.stderr}", "ERROR")
            return []
        
        contracts = []
        
        for line in result.stdout.strip().split('\n'):
            if not line.strip():
                continue
            
            try:
                data = json.loads(line)
                contract = self._parse_contract_data(data)
                if contract:
                    contracts.append(contract)
            except json.JSONDecodeError as e:
                self.log(f"JSON parse error: {e}", "WARN")
                continue
            except Exception as e:
                self.log(f"Parse error for line: {e}", "WARN")
                continue
        
        return contracts
    
    def _parse_contract_data(self, data: Dict) -> Optional[ScreenContract]:
        """Parse raw DB data into ScreenContract"""
        
        contract_id = data.get('contract_id')
        if not contract_id:
            return None
        
        route_path = data.get('route_path', '')
        screen_name = data.get('screen_name', f'Screen_{contract_id}')
        
        # Parse API contract
        api_contracts = self._parse_api_contract(data.get('api_contract'))
        
        # Parse state contract
        state_contracts = self._parse_state_contract(data.get('state_contract'))
        
        # Parse field contract
        field_contracts = self._parse_field_contract(data.get('field_contract'))
        
        # Parse section contract
        section_contracts = self._parse_section_contract(data.get('section_contract'))
        
        return ScreenContract(
            contract_id=contract_id,
            route_path=route_path,
            screen_name=screen_name,
            process_code=data.get('process_code', 'UNKNOWN'),
            actor_code=data.get('actor_code', 'USER'),
            step_code=data.get('step_code') or '',
            audience=data.get('audience') or '',
            business_purpose=data.get('business_purpose') or '',
            entry_condition=data.get('entry_condition') or '',
            exit_condition=data.get('exit_condition') or '',
            command_contract=self._json_value(data.get('command_contract'), []),
            data_contract=self._json_value(data.get('data_contract'), {}),
            evidence_contract=self._json_value(data.get('evidence_contract'), {}),
            responsive_contract=self._json_value(data.get('responsive_contract'), {}),
            accessibility_contract=self._json_value(data.get('accessibility_contract'), {}),
            security_contract=self._json_value(data.get('security_contract'), {}),
            input_schema=self._json_value(data.get('input_schema'), {}),
            output_schema=self._json_value(data.get('output_schema'), {}),
            persistence_schema=self._json_value(data.get('persistence_schema'), {}),
            handoff_schema=self._json_value(data.get('handoff_schema'), {}),
            context_keys=self._json_value(data.get('context_keys'), []),
            permissions=self._json_value(data.get('permissions'), []),
            tests=self._json_value(data.get('tests'), []),
            api_contract=api_contracts,
            state_contract=state_contracts,
            field_contract=field_contracts,
            section_contract=section_contracts
        )

    def _json_value(self, value, default):
        """Normalize PostgreSQL json/jsonb and legacy JSON text."""
        if value is None or value == '':
            return default
        if isinstance(value, (dict, list)):
            return value
        if isinstance(value, str):
            try:
                return json.loads(value)
            except (TypeError, json.JSONDecodeError):
                return default
        return default
    
    def _parse_api_contract(self, text) -> List[ApiContract]:
        """Parse API contract - handles both string and dict formats"""
        if not text:
            return []
        
        try:
            apis = json.loads(text) if isinstance(text, str) else (text if isinstance(text, list) else [])
        except:
            return []
        
        result = []
        for api in apis:
            if isinstance(api, str):
                parts = api.split(' ', 1)
                if len(parts) == 2:
                    result.append(ApiContract(
                        method=parts[0].upper(),
                        path=parts[1],
                        code=parts[1].split('/')[-1] or 'api'
                    ))
            elif isinstance(api, dict):
                result.append(ApiContract(
                    method=api.get('method', 'GET').upper(),
                    path=api.get('path', '/'),
                    code=api.get('code') or api.get('path', '/').split('/')[-1] or 'api'
                ))
        
        return [a for a in result if a.validate()]
    
    def _parse_state_contract(self, text) -> List[str]:
        """Parse state contract"""
        if not text:
            return ['READY']
        
        try:
            if isinstance(text, list):
                return [str(s) for s in text]
            if isinstance(text, str):
                if text.startswith('['):
                    return [str(s) for s in json.loads(text)]
                return [s.strip() for s in text.split(',') if s.strip()]
        except:
            pass
        
        return ['READY']
    
    def _parse_field_contract(self, text) -> List[FieldContract]:
        """Parse field contract - 21 field types supported"""
        if not text:
            return []
        
        try:
            fields = json.loads(text) if isinstance(text, str) else (text if isinstance(text, list) else [])
        except:
            return []
        
        result = []
        for f in fields:
            if isinstance(f, dict):
                dtype = (f.get('dataType', 'TEXT') or 'TEXT').upper()
                if dtype not in FIELD_TYPES:
                    dtype = 'TEXT'  # Default for unknown types
                
                result.append(FieldContract(
                    field_code=f.get('fieldCode', f.get('code', 'field')),
                    field_name=f.get('fieldName', f.get('label', '')),
                    data_type=dtype,
                    required=bool(f.get('required', False)),
                    options=f.get('options', []) if isinstance(f.get('options'), list) else [],
                    validation=f.get('validation', {}) if isinstance(f.get('validation'), dict) else {},
                    default_value=f.get('defaultValue'),
                    placeholder=f.get('placeholder', ''),
                    help_text=f.get('helpText', ''),
                    read_only=bool(f.get('readOnly', False)),
                    visible=bool(f.get('visible', True)) if f.get('visible') is not None else True,
                    section_code=f.get('sectionCode', 'default')
                ))
            elif isinstance(f, str):
                result.append(FieldContract(
                    field_code=f,
                    field_name=f,
                    data_type='TEXT',
                    required=False
                ))
        
        return result
    
    def _parse_section_contract(self, text) -> List[SectionContract]:
        """Parse section contract for complex layouts"""
        if not text:
            return [SectionContract(section_code='default', section_name='Main', order=1)]
        
        try:
            if isinstance(text, list):
                sections = text
            elif isinstance(text, str):
                if text.startswith('['):
                    sections = json.loads(text)
                else:
                    return [SectionContract(section_code='default', section_name=text, order=1)]
            else:
                sections = []
        except:
            return [SectionContract(section_code='default', section_name='Main', order=1)]
        
        result = []
        for i, s in enumerate(sections):
            if isinstance(s, dict):
                result.append(SectionContract(
                    section_code=s.get('sectionCode', f'section_{i}'),
                    section_name=s.get('sectionName', s.get('section_name', f'Section {i+1}')),
                    order=s.get('order', i + 1),
                    layout=s.get('layout', 'vertical'),
                    collapsible=bool(s.get('collapsible', False))
                ))
            elif isinstance(s, str):
                result.append(SectionContract(
                    section_code=f'section_{i}',
                    section_name=s,
                    order=i + 1
                ))
        
        return result if result else [SectionContract(section_code='default', section_name='Main', order=1)]
