"""Extract design/contract from database"""

import json
import subprocess
from pathlib import Path
from typing import List, Dict, Any, Optional
from datetime import datetime

from builder.common.types import ScreenContract, ApiContract, FieldContract, SectionContract, FIELD_TYPES, HTTP_METHODS
from builder.common.option_sources import resolve_option_contract
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
                   ss.input_schema, ss.output_schema, ss.field_schema,
                   ss.persistence_schema, ss.handoff_schema, ss.context_keys,
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
        reference_options = self._extract_reference_options()
        
        for line in result.stdout.strip().split('\n'):
            if not line.strip():
                continue
            
            try:
                data = json.loads(line)
                contract = self._parse_contract_data(data, reference_options)
                if contract:
                    contracts.append(contract)
            except json.JSONDecodeError as e:
                self.log(f"JSON parse error: {e}", "WARN")
                continue
            except Exception as e:
                self.log(f"Parse error for line: {e}", "WARN")
                continue
        
        return contracts
    
    def _parse_contract_data(self, data: Dict, reference_options: Dict[str, Any]) -> Optional[ScreenContract]:
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
        field_contracts = self._parse_field_contract(
            data.get('field_contract'),
            data.get('process_code', 'UNKNOWN'),
            reference_options
        )
        if not field_contracts:
            field_contracts = self._parse_field_contract(
                data.get('field_schema'),
                data.get('process_code', 'UNKNOWN'),
                reference_options
            )
        
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
    
    def _parse_field_contract(
        self,
        text,
        process_code: str = "UNKNOWN",
        reference_options: Dict[str, Any] = None,
    ) -> List[FieldContract]:
        """Parse field contract - 21 field types supported"""
        if not text:
            return []
        
        try:
            decoded = json.loads(text) if isinstance(text, str) else text
            if isinstance(decoded, dict):
                fields = decoded.get('fields') or decoded.get('items') or []
            else:
                fields = decoded if isinstance(decoded, list) else []
        except:
            return []
        
        result = []
        for f in fields:
            if isinstance(f, dict):
                dtype = self._normalize_field_type(
                    f.get('controlType') or f.get('dataType') or 'TEXT'
                )
                
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
        
        references = reference_options or {}
        for field in result:
            if field.data_type in ['SELECT', 'CODE', 'ENUM', 'RADIO', 'AUTOCOMPLETE'] and not field.options:
                options, source = resolve_option_contract(
                    field.field_code,
                    process_code,
                    references,
                )
                field.options = options
                field.option_source = source

        return result

    def _normalize_field_type(self, raw_type: Any) -> str:
        value = str(raw_type or 'TEXT').upper()
        aliases = {
            'STRING': 'TEXT',
            'INTEGER': 'NUMBER',
            'DECIMAL': 'NUMBER',
            'LONG': 'NUMBER',
            'BADGE': 'TEXT',
            'STATUS': 'CODE',
            'STATUS_SELECT': 'CODE',
            'QUALITY_SELECT': 'CODE',
            'DECISION_SELECT': 'CODE',
            'UNIT_SELECT': 'CODE',
            'PROJECT_SELECT': 'AUTOCOMPLETE',
            'ENTITY_SELECT': 'AUTOCOMPLETE',
            'FILE_UPLOAD': 'FILE',
            'JSON': 'CODE',
            'JSON_VIEW': 'CODE',
            'CODE_VIEW': 'CODE',
            'METRIC': 'NUMBER',
            'SEQUENCE': 'NUMBER',
            'VERSION': 'NUMBER',
            'ACTION': 'TEXT',
            'LINK': 'TEXT',
            'TASK_LINK': 'TEXT',
        }
        normalized = aliases.get(value, value)
        if normalized not in FIELD_TYPES and value.endswith('_SELECT'):
            normalized = 'SELECT'
        return normalized if normalized in FIELD_TYPES else 'TEXT'

    def _extract_reference_options(self) -> Dict[str, Any]:
        """Load reusable option catalogs once, avoiding per-screen DB queries."""
        sql = """SELECT json_build_object(
            'PROCESS', coalesce((SELECT json_agg(json_build_object(
                'value', process_code, 'label', process_name
            ) ORDER BY development_order, process_code)
            FROM framework_process_definition), '[]'::json),
            'PROCESS_STEP', coalesce((SELECT json_agg(json_build_object(
                'processCode', process_code, 'value', step_code, 'label', step_name
            ) ORDER BY process_code, step_order)
            FROM framework_process_step), '[]'::json),
            'ACTOR', coalesce((SELECT json_agg(json_build_object(
                'value', actor_code, 'label', actor_name
            ) ORDER BY actor_type, actor_code)
            FROM framework_actor_definition WHERE use_at='Y'), '[]'::json),
            'WORK_TYPE', coalesce((SELECT json_agg(json_build_object(
                'value', work_type_code, 'label', work_type_name
            ) ORDER BY sort_order, work_type_code)
            FROM framework_business_work_type WHERE use_at='Y'), '[]'::json),
            'AUTHORITY', coalesce((SELECT json_agg(json_build_object(
                'value', author_code, 'label', author_nm
            ) ORDER BY author_code)
            FROM comtnauthorinfo), '[]'::json),
            'COMMAND', coalesce((SELECT json_agg(json_build_object(
                'value', command_code, 'label', command_code
            ) ORDER BY command_code)
            FROM (SELECT DISTINCT command_code FROM framework_process_step
                  WHERE nullif(command_code,'') IS NOT NULL) q), '[]'::json),
            'PROCESS_STATE', coalesce((SELECT json_agg(json_build_object(
                'value', state_code, 'label', state_code
            ) ORDER BY state_code)
            FROM (SELECT DISTINCT from_state AS state_code FROM framework_process_step
                  UNION SELECT DISTINCT to_state FROM framework_process_step) q
            WHERE nullif(state_code,'') IS NOT NULL), '[]'::json),
            'SITE', coalesce((SELECT json_agg(json_build_object(
                'value', site_name, 'label', site_name
            ) ORDER BY site_name)
            FROM (SELECT DISTINCT site_name FROM emission_project_registry
                  WHERE nullif(site_name,'') IS NOT NULL) q), '[]'::json),
            'RESOURCE', coalesce((SELECT json_agg(json_build_object(
                'value', asset_id, 'label', asset_name
            ) ORDER BY asset_name, asset_id)
            FROM (SELECT asset_id, asset_name FROM framework_unified_asset
                  WHERE active_yn='Y' ORDER BY last_seen_at DESC NULLS LAST LIMIT 500) q), '[]'::json)
        )"""
        cmd = [
            "kubectl", "exec", self.db_config['pod'],
            "-n", self.db_config['namespace'],
            "--", "psql", "-h", "127.0.0.1",
            "-U", "postgres", "-d", self.db_config['database'],
            "-t", "-A", "-c", sql
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
        if result.returncode != 0:
            self.log(f"Reference option extraction failed: {result.stderr}", "ERROR")
            return {}
        try:
            catalogs = json.loads(result.stdout.strip())
        except (TypeError, json.JSONDecodeError):
            return {}
        steps = catalogs.pop('PROCESS_STEP', []) or []
        for item in steps:
            process = item.get('processCode')
            if process:
                catalogs.setdefault(f"PROCESS_STEP:{process}", []).append({
                    'value': item.get('value'),
                    'label': item.get('label'),
                })
        return catalogs
    
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
