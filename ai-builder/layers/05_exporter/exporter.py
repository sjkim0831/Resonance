"""Export and bundle generated screens"""

import json
from pathlib import Path
from typing import Dict, List, Any
from datetime import datetime

class Exporter:
    """Export screens and generate registry files"""
    
    def __init__(self, output_dir: Path):
        self.output_dir = output_dir
        self.runtime_dir = output_dir / "runtime"
        self.screens_dir = output_dir / "screens"
        self.index_dir = output_dir / "index"
        
        # Create directories
        for d in [self.runtime_dir, self.screens_dir, self.index_dir]:
            d.mkdir(parents=True, exist_ok=True)
    
    def export_all(self, screens: List[Dict], contracts: List[Dict]) -> Dict:
        """Export all screens and generate supporting files"""
        
        # Generate index files
        index_result = self._generate_index_files(screens)
        
        # Generate routes
        routes_result = self._generate_routes(screens)
        
        # Generate catalog
        catalog_result = self._generate_catalog(screens, contracts)
        
        # Copy runtime files
        runtime_result = self._copy_runtime()
        
        return {
            'index_files': index_result,
            'routes': routes_result,
            'catalog': catalog_result,
            'runtime': runtime_result
        }
    
    def _generate_index_files(self, screens: List[Dict]) -> Dict:
        """Generate index files for easy imports"""
        
        # Main index.tsx
        imports = []
        exports = []
        
        for s in screens:
            comp = s['component']
            file_path = f"./screens/{s['file'].split('/')[-1].replace('.tsx', '')}"
            imports.append(f"import {{ {comp} }} from '{file_path}';")
            exports.append(f"  {comp}: {comp},")
        
        index_code = f'''// Auto-generated Index
// Generated: {datetime.now().isoformat()}

{chr(10).join(imports)}

export const screens = {{
{chr(10).join(exports)}
}};

export type ScreenKey = keyof typeof screens;
'''
        
        with open(self.index_dir / "index.tsx", 'w', encoding='utf-8') as f:
            f.write(index_code)
        
        # Also export as named exports
        named_exports = '\n'.join([f"export {{ {s['component']} }};" for s in screens])
        with open(self.index_dir / "named_exports.tsx", 'w', encoding='utf-8') as f:
            f.write(f"// Named exports\n{named_exports}\n")
        
        return {'files_created': 2, 'screen_count': len(screens)}
    
    def _generate_routes(self, screens: List[Dict]) -> Dict:
        """Generate React Router routes"""
        
        route_imports = []
        route_elements = []
        
        for s in screens:
            comp = s['component']
            route = s['route']
            key = s['contract_id']
            route_imports.append(f"import {{ {comp} }} from '../screens/{comp}';")
            route_elements.append(f"  <Route key='{key}' path='{route}' element={<{comp} />} />")
        
        routes_code = f'''// Auto-generated Routes
// Generated: {datetime.now().isoformat()}

import React from 'react';
import {{ Routes, Route }} from 'react-router-dom';

{chr(10).join(route_imports)}

export const AppRoutes = () => (
  <Routes>
{chr(10).join(route_elements)}
  </Routes>
);

// Route metadata for menus
export const routeMetadata = {json.dumps([
    {{ path: s['route'], component: s['component'], screenName: s.get('screen_name', s['component']) }}
    for s in screens
], ensure_ascii=False, indent=2)};
'''
        
        routes_path = self.index_dir / "routes.tsx"
        with open(routes_path, 'w', encoding='utf-8') as f:
            f.write(routes_code)
        
        return {'file': str(routes_path), 'route_count': len(screens)}
    
    def _generate_catalog(self, screens: List[Dict], contracts: List[Dict]) -> Dict:
        """Generate complete catalog"""
        
        catalog = {
            'generated_at': datetime.now().isoformat(),
            'generator': 'Screen Composer v4',
            'total_screens': len(screens),
            'total_contracts': len(contracts),
            'screens': [
                {
                    'contract_id': s['contract_id'],
                    'component': s['component'],
                    'route': s['route'],
                    'file': s['file'],
                    'field_count': s.get('field_count', 0),
                    'section_count': s.get('section_count', 0)
                }
                for s in screens
            ],
            'contracts': [
                {
                    'id': c.get('contract_id'),
                    'route': c.get('route_path'),
                    'screen': c.get('screen_name'),
                    'process': c.get('process_code'),
                    'field_count': len(c.get('fields', [])),
                    'api_count': len(c.get('api_contract', []))
                }
                for c in contracts[:100]  # Limit to first 100 for catalog size
            ]
        }
        
        catalog_path = self.output_dir / "catalog.json"
        with open(catalog_path, 'w', encoding='utf-8') as f:
            json.dump(catalog, f, ensure_ascii=False, indent=2)
        
        return {'file': str(catalog_path), 'screens': len(screens)}
    
    def _copy_runtime(self) -> Dict:
        """Create runtime index that re-exports all runtime modules"""
        
        runtime_index = '''// Runtime Index - Re-exports all runtime modules
// Generated: {datetime.now().isoformat()}

export * from './types';
export * from './hooks';
export * from './utils';
export * from './FieldFactory';
export * from './FormComponents';
export * from './SectionComponents';
export * from './api_client';
export * from './screen_registry';
'''
        
        with open(self.runtime_dir / "index.ts", 'w', encoding='utf-8') as f:
            f.write(runtime_index)
        
        return {'file': str(self.runtime_dir / "index.ts")}
