#!/usr/bin/env python3
"""Contract Auto-Generator v2 - Handle mixed API formats"""

import json, os, re, sys, time, subprocess, hashlib
from datetime import datetime
from pathlib import Path

BASE_DIR = Path("/opt/Resonance/ai-builder")
OUTPUT_DIR = BASE_DIR / "output"
FRONTEND_OUTPUT = OUTPUT_DIR / "frontend"
BACKEND_OUTPUT = OUTPUT_DIR / "backend"
LOG_DIR = BASE_DIR / "logs"
STATE_FILE = LOG_DIR / ".contract_state.json"
WATCH_INTERVAL = 30
FRONTEND_SRC = Path("/opt/Resonance/projects/carbonet-frontend/source/src")
BACKEND_SRC = Path("/opt/Resonance/projects/carbonet-backend-metadata/builder/generated")


def parse_api_contract(text):
    """Parse API contract - handles both string and dict formats"""
    if not text:
        return []
    try:
        apis = json.loads(text)
    except:
        return []
    
    result = []
    for api in apis:
        if isinstance(api, str):
            # Format: "GET /path" or "POST /path"
            parts = api.split(' ', 1)
            if len(parts) == 2:
                result.append({'method': parts[0], 'path': parts[1], 'code': parts[1].split('/')[-1]})
            elif len(parts) == 1 and api:
                result.append({'method': 'GET', 'path': api, 'code': api.split('/')[-1]})
        elif isinstance(api, dict):
            result.append({
                'method': api.get('method', 'GET'),
                'path': api.get('path', '/'),
                'code': api.get('code') or api.get('path', '/').split('/')[-1]
            })
    return result


class ContractWatcher:
    def __init__(self):
        self.last_state = self._load_state()
    
    def _load_state(self):
        if STATE_FILE.exists():
            try:
                with open(STATE_FILE, 'r') as f:
                    return json.load(f)
            except:
                pass
        return {'checksum': '', 'timestamp': '', 'count': 0}
    
    def _save_state(self, state):
        LOG_DIR.mkdir(parents=True, exist_ok=True)
        with open(STATE_FILE, 'w') as f:
            json.dump(state, f, indent=2)
    
    def get_current_state(self):
        sql = """SELECT COUNT(*) as cnt, MAX(updated_at) as ts, string_agg(contract_id || ':' || contract_status, ',') as sig
FROM framework_professional_screen_contract WHERE contract_status IN ('VERIFIED', 'DESIGN_COMPLETE')"""
        
        cmd = ["kubectl", "exec", "postgres-patroni-1", "-n", "carbonet-prod",
               "--", "psql", "-h", "127.0.0.1", "-U", "postgres", "-d", "carbonet",
               "-t", "-A", "-c", sql]
        
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
        
        for line in result.stdout.strip().split('\n'):
            if '|' in line:
                parts = line.split('|')
                if len(parts) >= 3:
                    cnt = int(parts[0])
                    ts = parts[1] if parts[1] else ''
                    sig = parts[2] if len(parts) > 2 else ''
                    checksum = hashlib.md5(sig.encode()).hexdigest()[:16]
                    return {'count': cnt, 'timestamp': ts, 'checksum': checksum}
        return {'count': 0, 'timestamp': '', 'checksum': ''}
    
    def has_changed(self):
        current = self.get_current_state()
        changed = current['checksum'] != self.last_state.get('checksum')
        if changed:
            self.last_state = current
            self._save_state(current)
        return changed
    
    def get_stats(self):
        return self.get_current_state()


class ContractExtractor:
    def extract_all(self, limit=2000):
        sql = f"""SELECT row_to_json(c) FROM (
    SELECT c.contract_id, c.route_path, c.screen_name, c.process_code,
           c.step_code, c.actor_code,
           c.business_purpose, c.entry_condition, c.exit_condition,
           c.api_contract, c.state_contract, c.field_contract, c.updated_at
    FROM framework_professional_screen_contract c
    WHERE c.contract_status IN ('VERIFIED', 'DESIGN_COMPLETE')
    ORDER BY c.contract_id
    LIMIT {limit}
) c"""
        
        cmd = ["kubectl", "exec", "postgres-patroni-1", "-n", "carbonet-prod",
               "--", "psql", "-h", "127.0.0.1", "-U", "postgres", "-d", "carbonet",
               "-t", "-A", "-c", sql]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
        
        contracts = []
        for line in result.stdout.strip().split('\n'):
            if line.strip():
                try:
                    data = json.loads(line)
                    contracts.append({
                        'contract_id': data.get('contract_id'),
                        'route_path': data.get('route_path', ''),
                        'screen_name': data.get('screen_name', ''),
                        'process_code': data.get('process_code', 'UNKNOWN'),
                        'step_code': data.get('step_code', 'UNKNOWN'),
                        'actor_code': data.get('actor_code', 'USER'),
                        'business_purpose': data.get('business_purpose') or '',
                        'entry_condition': data.get('entry_condition') or '',
                        'exit_condition': data.get('exit_condition') or '',
                        'api_contract': parse_api_contract(data.get('api_contract')),
                        'state_contract': data.get('state_contract') or [],
                        'fields': data.get('field_contract') or [],
                        'updated_at': data.get('updated_at') or ''
                    })
                except Exception as e:
                    continue
        return contracts


class FrontendGenerator:
    def __init__(self, output_dir):
        self.output_dir = output_dir
        output_dir.mkdir(parents=True, exist_ok=True)
    
    def generate_all(self, contracts):
        files = []
        for c in contracts:
            try:
                files.append(self._generate_one(c))
            except Exception as e:
                print(f"  Error: {c.get('contract_id')}: {e}")
        
        catalog = {'generated_at': datetime.now().isoformat(), 'total': len(files), 'type': 'frontend', 'screens': files}
        with open(self.output_dir / 'catalog.json', 'w', encoding='utf-8') as f:
            json.dump(catalog, f, ensure_ascii=False, indent=2)
        return len(files), files
    
    def _generate_one(self, c):
        cid = c['contract_id']
        route = c['route_path']
        screen = c['screen_name']
        process = c['process_code']
        actor = c['actor_code']
        apis = c.get('api_contract', [])
        states = c.get('state_contract', [])
        fields = c.get('fields', [])
        
        comp_name = f"C{cid}_{re.sub(r'[^\w\s\uAC00-\uD7A3]', '', screen)}"
        state_list = ', '.join(states[:6]) if states else 'READY'
        
        api_lines = [f"// Contract #{cid} APIs"]
        call_lines = []
        for api in apis[:6]:
            method = api.get('method', 'GET')
            path = api.get('path', '/')
            code = api.get('code', 'api')
            api_lines.append(f"// {code}: {method} {path}")
            if method == 'GET':
                call_lines.append(f"      // GET: {code}")
                call_lines.append(f"      const r = await fetch('{path}');")
                call_lines.append(f"      const d = await r.json(); setData(d);")
            elif method == 'POST':
                call_lines.append(f"      // POST: {code}")
                call_lines.append(f"      const r = await fetch('{path}',{{method:'POST',headers:{{'Content-Type':'application/json'}},body:JSON.stringify(formData)}});")
                call_lines.append(f"      const d = await r.json();")
        
        if fields and len(fields) > 0:
            field_lines = ["        <Grid container spacing={2}>"]
            for f in fields[:10]:
                fc = f.get('fieldCode', f.get('code', 'field')) if isinstance(f, dict) else str(f)
                fl = f.get('fieldName', f.get('label', fc)) if isinstance(f, dict) else str(f)
                ft = (f.get('dataType', 'text') or 'text').lower() if isinstance(f, dict) else 'text'
                fr = 'true' if (isinstance(f, dict) and f.get('required')) else 'false'
                field_lines.append(f'          <Grid item xs={{12}} md={{6}} key="{fc}">')
                field_lines.append(f'            <TextField label="{fl}" type="{ft}" fullWidth required={{{fr}}} value={{formData.{fc}||\'\'}} onChange={{(e)=>setFormData({{...formData,{fc}:e.target.value}})}} />')
                field_lines.append('          </Grid>')
            field_lines.append("        </Grid>")
            field_section = '\n'.join(field_lines)
        else:
            field_section = '        <TextField label="Sample" fullWidth value={formData.sample||\'\'} onChange={(e)=>setFormData({{...formData,sample:e.target.value}})} />'
        
        code = f'''/**
 * Contract: #{cid} | Route: {route}
 * Process: {process} | Actor: {actor}
 * Screen: {screen}
 * Generated: {datetime.now().isoformat()}
 */

import React, {{ useState, useEffect, useCallback }} from 'react';
import {{ useNavigate }} from 'react-router-dom';
import {{ Card, CardContent, CardHeader, TextField, Button, Grid, Box, Typography, Alert, CircularProgress, Divider }} from '@mui/material';
import {{ Save, Cancel, Refresh }} from '@mui/icons-material';

{chr(10).join(api_lines)}

export const {comp_name}Screen = () => {{
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [screenState, setScreenState] = useState('LOADING');
  const [formData, setFormData] = useState({{}});

  // States: {state_list}

  useEffect(() => {{ setScreenState('READY'); }}, []);

  const loadData = useCallback(async () => {{
    setLoading(true);
    try {{
{chr(10).join(call_lines)}
    }} catch (err) {{
      setError(err.message); setScreenState('ERROR');
    }} finally {{ setLoading(false); }}
  }}, []);

  const handleSubmit = async () => {{
    setLoading(true);
    try {{ await loadData(); setScreenState('SAVED'); }}
    catch (err) {{ setError(err.message); setScreenState('ERROR'); }}
    finally {{ setLoading(false); }}
  }};

  return (
    <Card>
      <CardHeader title="{screen}" subheader="Contract-based" />
      <CardContent>
        {{screenState === 'LOADING' && <Box display="flex" justifyContent="center"><CircularProgress /></Box>}}
        {{error && <Alert severity="error">{{error}}</Alert>}}
        {{!error && screenState !== 'LOADING' && (
          <Box>
            <Typography variant="body2" color="textSecondary">
              Process: {process} | Actor: {actor} | Contract: #{cid}
            </Typography>
            <Divider sx={{ my: 2 }} />
            {field_section}
            <Divider sx={{ my: 2 }} />
            <Box display="flex" gap={{1}}>
              <Button variant="contained" onClick={{handleSubmit}} disabled={{loading}}>저장</Button>
              <Button variant="outlined" onClick={{() => navigate(-1)}}>취소</Button>
              <Button variant="text" onClick={{loadData}}>새로고침</Button>
            </Box>
          </Box>
        )}}
      </CardContent>
    </Card>
  );
}};

export default {comp_name}Screen;
'''
        
        filepath = self.output_dir / f"{comp_name}Screen.tsx"
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(code)
        
        return {'contract_id': cid, 'route': route, 'screen_name': screen, 'component': f"{comp_name}Screen", 'file': f"{comp_name}Screen.tsx"}


class BackendGenerator:
    def __init__(self, output_dir):
        self.output_dir = output_dir
        for d in ['controller', 'service', 'repository', 'dto']:
            (output_dir / d).mkdir(parents=True, exist_ok=True)
    
    def generate_all(self, contracts):
        counts = {'controller': 0, 'service': 0, 'repository': 0, 'dto': 0}
        all_files = []
        
        for c in contracts:
            files = self._generate_one(c)
            all_files.extend(files)
            for f in files:
                for key in counts:
                    if f'/builder/generated/{key}/' in f:
                        counts[key] += 1
        
        catalog = {'generated_at': datetime.now().isoformat(), 'total_contracts': len(contracts),
                   'total_files': len(all_files), 'by_type': counts, 'type': 'backend'}
        with open(self.output_dir / 'catalog.json', 'w', encoding='utf-8') as f:
            json.dump(catalog, f, ensure_ascii=False, indent=2)
        return len(all_files), counts
    
    def _sanitize(self, name):
        if not name:
            return 'Api'
        name = re.sub(r'[^a-zA-Z0-9\uAC00-\uD7A3_]', '_', name)
        name = re.sub(r'_+', '_', name).strip('_')
        if name and name[0].isdigit():
            name = 'A' + name
        return name or 'Api'
    
    def _generate_one(self, c):
        cid = c['contract_id']
        route = c['route_path']
        screen = c['screen_name']
        process = c['process_code']
        actor = c['actor_code']
        entry = (c.get('entry_condition') or '')[:80]
        apis = c.get('api_contract', [])
        
        clean = re.sub(r'[^a-zA-Z0-9\uAC00-\uD7A3]', '', screen)
        if len(clean) > 35:
            clean = clean[:35]
        class_name = f"C{cid}_{clean}" if clean else f"C{cid}Screen"
        
        files = []
        
        methods = []
        for api in apis[:8]:
            path_vars = re.findall(r'\{([^}]+)\}', api.get('path', ''))
            params = ', '.join([f'@PathVariable Long {v}' for v in path_vars]) if path_vars else ''
            http = api.get('method', 'GET').lower()
            method_name = self._sanitize(api.get('path', '/').replace('/home/api/', '').replace('/', '_'))
            
            methods.append(f'''
    // {api.get('code', 'api')} - {api.get('method', '?')} {api.get('path', '?')}
    @{http.title()}Mapping("{api.get('path', '/')}")
    public ResponseEntity<?> {method_name}({params}) {{
        log.info("Contract #{{}}: {{}}", {cid}, "{api.get('code', 'api')}");
        // Entry: {entry}
        return ResponseEntity.ok().build();
    }}''')
        
        ctrl_code = f'''package com.carbonet.api.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@RestController
@RequestMapping("/home/api")
@RequiredArgsConstructor
public class {class_name}Controller {{

    private final {class_name}Service service;
{chr(10).join(methods)}
}}
'''
        ctrl_path = self.output_dir / 'controller' / f'{class_name}Controller.java'
        with open(ctrl_path, 'w', encoding='utf-8') as f:
            f.write(ctrl_code)
        files.append(str(ctrl_path))
        
        svc_methods = []
        for api in apis[:8]:
            params = ', '.join([f'Long {v}' for v in re.findall(r'\{([^}]+)\}', api.get('path', ''))])
            method_name = self._sanitize(api.get('path', '/').replace('/home/api/', '').replace('/', '_'))
            svc_methods.append(f'''
    // {api.get('code', 'api')}
    public Object {method_name}({params}) {{
        log.info("Contract #{{}}: {{}}", {cid}, "{api.get('code', 'api')}");
        return null;
    }}''')
        
        svc_code = f'''package com.carbonet.api.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class {class_name}Service {{{chr(10).join(svc_methods)}
}}
'''
        svc_path = self.output_dir / 'service' / f'{class_name}Service.java'
        with open(svc_path, 'w', encoding='utf-8') as f:
            f.write(svc_code)
        files.append(str(svc_path))
        
        repo_code = f'''package com.carbonet.api.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface {class_name}Repository extends JpaRepository<{class_name}Entity, Long> {{
}}
'''
        repo_path = self.output_dir / 'repository' / f'{class_name}Repository.java'
        with open(repo_path, 'w', encoding='utf-8') as f:
            f.write(repo_code)
        files.append(str(repo_path))
        
        dto_code = f'''package com.carbonet.api.dto;

import lombok.Data;

@Data
public class {class_name}Dto {{
    private Long id;
    private String data;
}}
'''
        dto_path = self.output_dir / 'dto' / f'{class_name}Dto.java'
        with open(dto_path, 'w', encoding='utf-8') as f:
            f.write(dto_code)
        files.append(str(dto_path))
        
        return files


class DeployManager:
    def __init__(self):
        self.frontend_src = FRONTEND_SRC
        self.backend_src = BACKEND_SRC
    
    def deploy_frontend(self, source_dir):
        try:
            target = self.frontend_src / 'generated' / 'screens'
            target.mkdir(parents=True, exist_ok=True)
            count = 0
            for f in source_dir.glob('*.tsx'):
                if f.name == 'catalog.json':
                    continue
                dest = target / f.name
                dest.write_text(f.read_text(encoding='utf-8'), encoding='utf-8')
                count += 1
            catalog_src = source_dir / 'catalog.json'
            if catalog_src.exists():
                dest = target / 'catalog.json'
                dest.write_text(catalog_src.read_text(encoding='utf-8'), encoding='utf-8')
            return count
        except Exception as e:
            print(f"  Frontend deploy error: {e}")
            return 0
    
    def deploy_backend(self, source_dir):
        result = {'controller': 0, 'service': 0, 'repository': 0, 'dto': 0}
        try:
            target = self.backend_src
            target.mkdir(parents=True, exist_ok=True)
            for key in result:
                src_dir = source_dir / key
                if src_dir.exists():
                    for f in src_dir.glob('*.java'):
                        dest = target / key / f.name
                        dest.write_text(f.read_text(encoding='utf-8'), encoding='utf-8')
                        result[key] += 1
            catalog_src = source_dir / 'catalog.json'
            if catalog_src.exists():
                dest = target / 'catalog.json'
                dest.write_text(catalog_src.read_text(encoding='utf-8'), encoding='utf-8')
        except Exception as e:
            print(f"  Backend deploy error: {e}")
        return result


class ContractAutoGenerator:
    def __init__(self):
        self.watcher = ContractWatcher()
        self.extractor = ContractExtractor()
        self.frontend_gen = FrontendGenerator(FRONTEND_OUTPUT)
        self.backend_gen = BackendGenerator(BACKEND_OUTPUT)
        self.deployer = DeployManager()
        self.log_file = LOG_DIR / f"auto-gen-{datetime.now().strftime('%Y%m%d')}.log"
    
    def log(self, msg):
        timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        log_line = f"[{timestamp}] {msg}"
        print(log_line)
        LOG_DIR.mkdir(parents=True, exist_ok=True)
        with open(self.log_file, 'a') as f:
            f.write(log_line + '\n')
    
    def run_once(self):
        self.log("=" * 60)
        self.log("Contract Auto-Generator v2: Starting...")
        
        if not self.watcher.has_changed():
            stats = self.watcher.get_stats()
            self.log(f"No changes detected. Last: {stats['count']} contracts")
            return False
        
        self.log("Change detected! Extracting contracts...")
        contracts = self.extractor.extract_all()
        self.log(f"Extracted {len(contracts)} contracts")
        
        if not contracts:
            self.log("ERROR: No contracts found!")
            return False
        
        self.log("Generating Frontend...")
        fe_count, fe_files = self.frontend_gen.generate_all(contracts)
        self.log(f"Frontend: {fe_count} files generated")
        
        self.log("Generating Backend...")
        be_count, be_counts = self.backend_gen.generate_all(contracts)
        self.log(f"Backend: {be_count} files generated ({be_counts})")
        
        self.log("Deploying to projects...")
        fe_deployed = self.deployer.deploy_frontend(FRONTEND_OUTPUT)
        self.log(f"Frontend deployed: {fe_deployed} files")
        
        be_deployed = self.deployer.deploy_backend(BACKEND_OUTPUT)
        self.log(f"Backend deployed: {be_deployed}")
        
        self.log(f"SUCCESS! Deployed {fe_count} frontend + {be_count} backend files")
        self.log("=" * 60)
        return True
    
    def run_watch(self):
        self.log("Starting Contract Auto-Generator in watch mode")
        self.log(f"Watch interval: {WATCH_INTERVAL} seconds")
        while True:
            try:
                self.run_once()
            except Exception as e:
                self.log(f"ERROR: {e}")
            time.sleep(WATCH_INTERVAL)


def main():
    gen = ContractAutoGenerator()
    if len(sys.argv) > 1 and sys.argv[1] == '--once':
        gen.run_once()
    else:
        gen.run_watch()


if __name__ == "__main__":
    main()
