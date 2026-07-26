"""Contract extraction from database with parsing"""

import json
import subprocess
from pathlib import Path
from typing import Dict, List, Any, Optional
from datetime import datetime

class ContractExtractor:
    """Extract and parse contracts from PostgreSQL"""
    
    def __init__(self, output_dir: Path):
        self.output_dir = output_dir
        self.output_dir.mkdir(parents=True, exist_ok=True)
    
    def extract_all(self, limit: int = 2000) -> List[Dict]:
        """Extract all contracts from DB"""
        sql = f"""SELECT row_to_json(c) FROM (
            SELECT c.contract_id, c.route_path, c.screen_name, c.process_code,
                   c.step_code, c.actor_code, c.business_purpose,
                   c.entry_condition, c.exit_condition,
                   c.api_contract, c.state_contract, c.field_contract,
                   c.section_contract, c.updated_at
            FROM framework_professional_screen_contract c
            WHERE c.contract_status IN ('VERIFIED', 'DESIGN_COMPLETE')
            ORDER BY c.contract_id
            LIMIT {limit}
        ) c"""
        
        cmd = ["kubectl", "exec", "postgres-patroni-1", "-n", "carbonet-prod",
               "--", "psql", "-h", "127.0.0.1", "-U", "postgres", "-d", "carbonet",
               "-t", "-A", "-c", sql]
        
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=180)
        
        if result.returncode != 0:
            raise Exception(f"DB extraction failed: {result.stderr}")
        
        contracts = []
        for line in result.stdout.strip().split('\n'):
            if line.strip():
                try:
                    data = json.loads(line)
                    contract = self._parse_contract(data)
                    contracts.append(contract)
                except Exception as e:
                    print(f"Parse error: {e}")
                    continue
        
        return contracts
    
    def _parse_contract(self, data: Dict) -> Dict:
        """Parse single contract with all nested fields"""
        return {
            'contract_id': data.get('contract_id'),
            'route_path': data.get('route_path', ''),
            'screen_name': data.get('screen_name', ''),
            'process_code': data.get('process_code', 'UNKNOWN'),
            'step_code': data.get('step_code', 'UNKNOWN'),
            'actor_code': data.get('actor_code', 'USER'),
            'business_purpose': data.get('business_purpose') or '',
            'entry_condition': data.get('entry_condition') or '',
            'exit_condition': data.get('exit_condition') or '',
            'api_contract': self._parse_api(data.get('api_contract')),
            'state_contract': self._parse_state(data.get('state_contract')),
            'fields': self._parse_fields(data.get('field_contract')),
            'sections': self._parse_sections(data.get('section_contract')),
            'updated_at': data.get('updated_at', '')
        }
    
    def _parse_api(self, text) -> List[Dict]:
        """Parse API contract (handles both string and dict formats)"""
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
                    result.append({
                        'method': parts[0].upper(),
                        'path': parts[1],
                        'code': parts[1].split('/')[-1] or 'api'
                    })
            elif isinstance(api, dict):
                result.append({
                    'method': api.get('method', 'GET').upper(),
                    'path': api.get('path', '/'),
                    'code': api.get('code') or api.get('path', '/').split('/')[-1] or 'api'
                })
        return result
    
    def _parse_state(self, text) -> List[str]:
        """Parse state contract"""
        if not text:
            return ['READY']
        try:
            if isinstance(text, list):
                return [str(s) for s in text]
            if isinstance(text, str):
                return json.loads(text) if text.startswith('[') else [s.strip() for s in text.split(',')]
        except:
            pass
        return ['READY']
    
    def _parse_fields(self, text) -> List[Dict]:
        """Parse field contract - 20 field types supported"""
        if not text:
            return []
        try:
            fields = json.loads(text) if isinstance(text, str) else (text if isinstance(text, list) else [])
        except:
            return []
        
        result = []
        for f in fields:
            if isinstance(f, dict):
                result.append({
                    'fieldCode': f.get('fieldCode', f.get('code', 'field')),
                    'fieldName': f.get('fieldName', f.get('label', '')),
                    'dataType': (f.get('dataType', 'TEXT') or 'TEXT').upper(),
                    'required': bool(f.get('required', False)),
                    'validation': f.get('validation', {}),
                    'options': f.get('options', []),
                    'defaultValue': f.get('defaultValue'),
                    'placeholder': f.get('placeholder', ''),
                    'helpText': f.get('helpText', ''),
                    'readOnly': bool(f.get('readOnly', False)),
                    'visible': bool(f.get('visible', True)),
                    'sectionCode': f.get('sectionCode', 'default')
                })
            elif isinstance(f, str):
                result.append({
                    'fieldCode': f,
                    'fieldName': f,
                    'dataType': 'TEXT',
                    'required': False,
                    'options': [],
                    'sectionCode': 'default'
                })
        return result
    
    def _parse_sections(self, text) -> List[Dict]:
        """Parse section contract for complex layouts"""
        if not text:
            return [{'sectionCode': 'default', 'sectionName': 'Default Section', 'order': 1}]
        try:
            if isinstance(text, list):
                return text
            if isinstance(text, str):
                return json.loads(text) if text.startswith('[') else \
                       [{'sectionCode': 'default', 'sectionName': text, 'order': 1}]
        except:
            pass
        return [{'sectionCode': 'default', 'sectionName': 'Default Section', 'order': 1}]
    
    def save_catalog(self, contracts: List[Dict]) -> Path:
        """Save contract catalog"""
        catalog = {
            'generated_at': datetime.now().isoformat(),
            'total': len(contracts),
            'contracts': [{
                'id': c['contract_id'],
                'route': c['route_path'],
                'screen': c['screen_name'],
                'field_count': len(c['fields']),
                'section_count': len(c['sections']),
                'api_count': len(c['api_contract'])
            } for c in contracts]
        }
        path = self.output_dir / "contract_catalog.json"
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(catalog, f, ensure_ascii=False, indent=2)
        return path
