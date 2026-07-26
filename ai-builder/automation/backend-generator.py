#!/usr/bin/env python3
"""Backend Java Code Generator from Contract"""

import json, os, re, subprocess, sys
from datetime import datetime

OUTPUT_DIR = '/tmp/contract-based-backend'
LIMIT = 50

def sanitize(name):
    """Make valid Java identifier"""
    if not name:
        return 'Api'
    # Replace hyphens/spaces with underscores, remove other invalid chars
    name = re.sub(r'[^a-zA-Z0-9\uAC00-\uD7A3_]', '_', name)
    name = re.sub(r'_+', '_', name).strip('_')
    if name[0].isdigit():
        name = 'A' + name
    return name if name else 'Api'

def to_class_name(screen_name, contract_id):
    clean = re.sub(r'[^a-zA-Z0-9\uAC00-\uD7A3]', '', screen_name)
    if len(clean) > 35:
        clean = clean[:35]
    return f"C{contract_id}_{clean}" if clean else f"C{contract_id}Screen"

def to_method_name(path, index=0):
    """Generate valid method name from path"""
    name = path.replace('/home/api/', '').replace('/{id}', '').replace('/{projectId}', '')
    name = re.sub(r'\{[^}]+\}', '', name)
    parts = [p for p in name.strip('/').split('/') if p]
    if not parts:
        return f'api{index}'
    result = '_'.join(parts[:5])
    result = sanitize(result)
    return result if result else f'api{index}'

class ContractExtractor:
    def extract_all(self, limit=50):
        sql = """
        SELECT c.contract_id, c.route_path, c.screen_name, c.process_code,
               c.step_code, c.actor_code,
               COALESCE(c.api_contract, '[]') as api_contract,
               COALESCE(c.entry_condition, '') as ec
        FROM framework_professional_screen_contract c
        WHERE c.contract_status IN ('VERIFIED', 'DESIGN_COMPLETE')
        ORDER BY c.contract_id
        LIMIT """ + str(limit)
        
        cmd = ["kubectl", "exec", "postgres-patroni-1", "-n", "carbonet-prod",
               "--", "psql", "-h", "127.0.0.1", "-U", "postgres", "-d", "carbonet",
               "-t", "-A", "-c", sql]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
        
        contracts = []
        for line in result.stdout.strip().split('\n'):
            if '|' not in line: continue
            parts = line.split('|')
            if len(parts) < 8: continue
            try:
                contracts.append({
                    'contract_id': int(parts[0]),
                    'route_path': parts[1],
                    'screen_name': parts[2],
                    'process_code': parts[3],
                    'step_code': parts[4],
                    'actor_code': parts[5],
                    'api_contract': self._parse_apis(parts[6]),
                    'entry_condition': parts[7][:80] if len(parts) > 7 else ''
                })
            except: continue
        print(f"Extracted {len(contracts)} contracts")
        return contracts
    
    def _parse_apis(self, text):
        if not text: return []
        try:
            apis = json.loads(text)
        except: return []
        
        result = []
        for api in apis:
            if isinstance(api, str):
                parts = api.split(' ', 1)
                if len(parts) == 2:
                    result.append({'method': parts[0], 'path': parts[1], 'code': parts[1].split('/')[-1]})
            elif isinstance(api, dict):
                result.append({
                    'method': api.get('method', 'GET'),
                    'path': api.get('path', '/'),
                    'code': api.get('code') or api.get('path', '/').split('/')[-1]
                })
        return result

class BackendGenerator:
    def __init__(self, out):
        self.out = out
        for d in ['controller', 'service', 'repository', 'dto']:
            os.makedirs(os.path.join(out, d), exist_ok=True)
    
    def generate_all(self, contract):
        cid = contract['contract_id']
        route = contract['route_path']
        screen = contract['screen_name']
        process = contract['process_code']
        actor = contract['actor_code']
        entry = contract.get('entry_condition', '')
        apis = contract.get('api_contract', [])
        
        class_name = to_class_name(screen, cid)
        files = []
        
        ctrl = self._gen_ctrl(class_name, cid, route, screen, process, actor, entry, apis)
        files.append(ctrl)
        
        svc = self._gen_svc(class_name, cid, apis)
        files.append(svc)
        
        repo = self._gen_repo(class_name)
        files.append(repo)
        
        dto = self._gen_dto(class_name)
        files.append(dto)
        
        return files
    
    def _gen_ctrl(self, class_name, cid, route, screen, process, actor, entry, apis):
        methods = []
        for i, api in enumerate(apis[:8]):
            path_vars = re.findall(r'\{([^}]+)\}', api['path'])
            params = ', '.join([f'@PathVariable Long {v}' for v in path_vars]) if path_vars else ''
            http = api['method'].lower()
            method_name = to_method_name(api['path'], i)
            
            methods.append(f'''
    // {api['code']} - {api['method']} {api['path']}
    @{http.title()}Mapping("{api['path']}")
    public ResponseEntity<?> {method_name}({params}) {{
        log.info("Contract #{{}}: {{}}", {cid}, "{api['code']}");
        // Entry: {entry}
        return ResponseEntity.ok().build();
    }}''')
        
        code = f'''package com.carbonet.api.controller;

/**
 * Contract: #{cid} | Route: {route}
 * Process: {process} | Actor: {actor}
 * Screen: {screen}
 * Generated: {datetime.now().isoformat()}
 */
@Slf4j
@RestController
@RequestMapping("/home/api")
@RequiredArgsConstructor
public class {class_name}Controller {{

    private final {class_name}Service service;
{chr(10).join(methods)}
}}
'''
        fp = os.path.join(self.out, 'controller', f'{class_name}Controller.java')
        with open(fp, 'w', encoding='utf-8') as f: f.write(code)
        return fp
    
    def _gen_svc(self, class_name, cid, apis):
        methods = []
        for i, api in enumerate(apis[:8]):
            params = ', '.join([f'Long {v}' for v in re.findall(r'\{([^}]+)\}', api['path'])])
            method_name = to_method_name(api['path'], i)
            methods.append(f'''
    // {api['code']}
    public Object {method_name}({params}) {{
        log.info("Contract #{{}}: {{}}", {cid}, "{api['code']}");
        // TODO: Implement business logic
        return null;
    }}''')
        
        code = f'''package com.carbonet.api.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class {class_name}Service {{

{chr(10).join(methods)}
}}
'''
        fp = os.path.join(self.out, 'service', f'{class_name}Service.java')
        with open(fp, 'w', encoding='utf-8') as f: f.write(code)
        return fp
    
    def _gen_repo(self, class_name):
        code = f'''package com.carbonet.api.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface {class_name}Repository extends JpaRepository<{class_name}Entity, Long> {{
    // TODO: Add custom queries
}}
'''
        fp = os.path.join(self.out, 'repository', f'{class_name}Repository.java')
        with open(fp, 'w', encoding='utf-8') as f: f.write(code)
        return fp
    
    def _gen_dto(self, class_name):
        code = f'''package com.carbonet.api.dto;

import lombok.Data;

@Data
public class {class_name}Request {{
    private Long id;
    private String data;
}}

@Data
public class {class_name}Response {{
    private Long id;
    private String data;
    private boolean success;
}}
'''
        fp = os.path.join(self.out, 'dto', f'{class_name}Dto.java')
        with open(fp, 'w', encoding='utf-8') as f: f.write(code)
        return fp

def main():
    global OUTPUT_DIR, LIMIT
    if len(sys.argv) > 1: LIMIT = int(sys.argv[1])
    if len(sys.argv) > 2: OUTPUT_DIR = sys.argv[2]
    
    print("=" * 60)
    print("Backend Java Code Generator v3")
    print("=" * 60)
    
    print("\n[1/3] Extracting contracts...")
    extractor = ContractExtractor()
    contracts = extractor.extract_all(LIMIT)
    if not contracts: return
    
    print(f"\n[2/3] Generating code for {len(contracts)} contracts...")
    gen = BackendGenerator(OUTPUT_DIR)
    files = []
    for i, c in enumerate(contracts):
        files.extend(gen.generate_all(c))
        if (i+1) % 100 == 0: print(f"  {i+1}/{len(contracts)}")
    
    ctrl = len([f for f in files if '/controller/' in f])
    svc = len([f for f in files if '/service/' in f])
    repo = len([f for f in files if '/repository/' in f])
    dto = len([f for f in files if '/dto/' in f])
    
    print(f"\n[3/3] Saving catalog...")
    catalog = {
        'generated_at': datetime.now().isoformat(),
        'contracts': len(contracts),
        'files': len(files),
        'controllers': ctrl, 'services': svc, 'repositories': repo, 'dtos': dto
    }
    with open(os.path.join(OUTPUT_DIR, 'catalog.json'), 'w') as f:
        json.dump(catalog, f, ensure_ascii=False, indent=2)
    
    print(f"\n{'=' * 60}")
    print(f"Done! {len(files)} files: {ctrl}Ctrl, {svc}Svc, {repo}Repo, {dto}Dto")
    print(f"Output: {OUTPUT_DIR}")
    print(f"{'=' * 60}")

if __name__ == "__main__":
    main()
