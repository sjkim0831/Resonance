"""Export routes and catalog"""

import json
from collections import defaultdict
from pathlib import Path
from typing import List, Dict, Any, Tuple

from builder.common.base import LayerBase, LayerResult

class ScreenExporter(LayerBase):
    """Layer 07: Export routes and catalog"""
    
    def __init__(self, output_dir: Path = None):
        super().__init__(7, "Export", "Export routes and catalog")
        self.output_dir = output_dir or Path("/tmp/builder_output/07_export")
        self.output_dir.mkdir(parents=True, exist_ok=True)
    
    def execute(self, context: Dict, input_data: Any) -> Tuple[bool, Dict[str, Any], LayerResult]:
        """Export routes and catalog"""
        self.log("Starting export")
        
        # Use context.contracts instead of context.get()
        contracts = getattr(context, 'contracts', [])
        
        # Generate routes.tsx
        routes_file = self._generate_routes(contracts)
        
        # Generate catalog.json
        catalog_file = self._generate_catalog(contracts)
        
        # Generate navigation config
        nav_file = self._generate_navigation(contracts)
        
        artifacts = {
            'routes': routes_file,
            'catalog': catalog_file,
            'navigation': nav_file
        }
        
        result = self.create_result(
            True, 0.1,
            files_created=3,
            processed_count=len(contracts),
            artifacts=artifacts
        )
        
        self.log("Exported routes, catalog, and navigation")
        return True, artifacts, result
    
    def _generate_routes(self, contracts: List) -> str:
        """Generate React Router routes - using string concatenation"""
        routes_path = self.output_dir / "routes.tsx"
        
        lines = [
            "import React from 'react';",
            "import { Routes, Route } from 'react-router-dom';",
            "",
            "// Auto-generated routes",
            "// This file should be regenerated when contracts change",
            "",
            "const AppRoutes: React.FC = () => {",
            "  return (",
        ]
        
        # Add exactly one route entry for a shared multi-process workspace.
        for c in self._route_owners(contracts).values():
            screen_name = "Screen" + str(c.contract_id)
            route_line = '  <Route path="' + c.route_path + '" element={<' + screen_name + ' />} />'
            lines.append(route_line)
        
        lines.extend([
            "  );",
            "};",
            "",
            "export default AppRoutes;",
        ])
        
        with open(routes_path, 'w', encoding='utf-8') as f:
            f.write('\n'.join(lines))
        
        return str(routes_path)
    
    def _generate_catalog(self, contracts: List) -> str:
        """Generate screen catalog JSON"""
        catalog_path = self.output_dir / "catalog.json"
        
        catalog = {
            'generated_at': '',
            'total_screens': len(contracts),
            'screens': []
        }
        
        route_owners = self._route_owners(contracts)
        route_bindings = self._route_bindings(contracts)
        for c in contracts:
            owner = route_owners.get(c.route_path, c)
            catalog['screens'].append({
                'contract_id': c.contract_id,
                'route': c.route_path,
                'screen_name': c.screen_name,
                'process_code': getattr(c, 'process_code', 'UNKNOWN'),
                'actor_code': getattr(c, 'actor_code', 'USER'),
                'route_owner_contract_id': owner.contract_id,
                'route_ownership': 'PRIMARY' if owner.contract_id == c.contract_id else 'SHARED_WORKSPACE',
                'route_bindings': route_bindings.get(c.route_path, []),
                'step_code': getattr(c, 'step_code', ''),
                'audience': getattr(c, 'audience', ''),
                'business_purpose': getattr(c, 'business_purpose', ''),
                'contract_layers': c.to_five_layer_contract(),
                'entry_condition': getattr(c, 'entry_condition', ''),
                'exit_condition': getattr(c, 'exit_condition', ''),
                'states': getattr(c, 'state_contract', []),
                'sections': [
                    {
                        'code': s.section_code,
                        'name': s.section_name,
                        'order': s.order,
                        'layout': s.layout,
                        'collapsible': s.collapsible
                    }
                    for s in getattr(c, 'section_contract', [])
                ],
                'input_schema': getattr(c, 'input_schema', {}),
                'output_schema': getattr(c, 'output_schema', {}),
                'persistence_schema': getattr(c, 'persistence_schema', {}),
                'handoff_schema': getattr(c, 'handoff_schema', {}),
                'context_keys': getattr(c, 'context_keys', []),
                'permissions': getattr(c, 'permissions', []),
                'tests': getattr(c, 'tests', []),
                'data_contract': getattr(c, 'data_contract', {}),
                'evidence_contract': getattr(c, 'evidence_contract', {}),
                'field_count': c.get_field_count(),
                'section_count': c.get_section_count(),
                'api_count': c.get_api_count(),
                'apis': [
                    {'method': a.method, 'path': a.path, 'code': a.code}
                    for a in getattr(c, 'api_contract', [])
                ],
                'fields': [
                    {
                        'code': f.field_code,
                        'name': f.field_name,
                        'type': f.data_type,
                        'required': f.required,
                        'section': f.section_code,
                        'options': f.options,
                        'optionSource': f.option_source,
                        'validation': f.validation,
                        'defaultValue': f.default_value,
                        'placeholder': f.placeholder,
                        'helpText': f.help_text,
                        'readOnly': f.read_only,
                        'visible': f.visible
                    }
                    for f in getattr(c, 'field_contract', [])
                ]
            })
        
        with open(catalog_path, 'w', encoding='utf-8') as f:
            json.dump(catalog, f, ensure_ascii=False, indent=2)
        
        return str(catalog_path)

    def _route_owners(self, contracts: List) -> Dict[str, Any]:
        """Choose one deterministic owner without discarding step bindings."""
        grouped: Dict[str, List] = defaultdict(list)
        for contract in contracts:
            grouped[contract.route_path].append(contract)
        return {
            route: max(
                owners,
                key=lambda item: (
                    item.get_field_count() + item.get_api_count() + item.get_section_count(),
                    -int(item.contract_id),
                ),
            )
            for route, owners in grouped.items()
            if route
        }

    def _route_bindings(self, contracts: List) -> Dict[str, List[Dict[str, Any]]]:
        grouped: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
        for contract in contracts:
            grouped[contract.route_path].append({
                'contractId': contract.contract_id,
                'processCode': getattr(contract, 'process_code', ''),
                'stepCode': getattr(contract, 'step_code', ''),
                'actorCode': getattr(contract, 'actor_code', ''),
                'audience': getattr(contract, 'audience', ''),
            })
        for bindings in grouped.values():
            bindings.sort(key=lambda item: (
                item['processCode'], item['stepCode'], item['contractId']
            ))
        return dict(grouped)
    
    def _generate_navigation(self, contracts: List) -> str:
        """Generate navigation configuration"""
        nav_path = self.output_dir / "navigation.json"
        
        # Group by process_code
        by_process: Dict[str, List] = {}
        for c in contracts:
            process = getattr(c, 'process_code', 'OTHER') or 'OTHER'
            if process not in by_process:
                by_process[process] = []
            by_process[process].append({
                'route': c.route_path,
                'screen_name': c.screen_name,
                'contract_id': c.contract_id
            })
        
        navigation = {
            'generated_at': '',
            'groups': [
                {
                    'code': process,
                    'screens': screens
                }
                for process, screens in sorted(by_process.items())
            ]
        }
        
        with open(nav_path, 'w', encoding='utf-8') as f:
            json.dump(navigation, f, ensure_ascii=False, indent=2)
        
        return str(nav_path)
