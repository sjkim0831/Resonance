#!/usr/bin/env python3
"""
Master Generator v4 - Layered Architecture for Mass Screen Generation
"""

import json
import sys
import time
import traceback
import re
from pathlib import Path
from typing import Dict, List, Any
from datetime import datetime
import subprocess

BASE_OUTPUT = Path("/tmp/master_output")
BASE_OUTPUT.mkdir(parents=True, exist_ok=True)

# ============================================================================
# Contract Extractor
# ============================================================================

def extract_contracts(limit=2000) -> List[Dict]:
    sql = f"""SELECT row_to_json(c) FROM (
        SELECT c.contract_id, c.route_path, c.screen_name, c.process_code,
               c.step_code, c.actor_code, c.api_contract, c.state_contract, 
               c.field_contract, c.section_contract
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
        raise Exception(f"DB failed: {result.stderr}")
    
    contracts = []
    for line in result.stdout.strip().split('\n'):
        if line.strip():
            try:
                data = json.loads(line)
                contracts.append(parse_contract(data))
            except:
                continue
    return contracts

def parse_contract(data: Dict) -> Dict:
    def parse_api(t):
        if not t: return []
        try:
            apis = json.loads(t) if isinstance(t, str) else (t if isinstance(t, list) else [])
            result = []
            for api in apis:
                if isinstance(api, str):
                    parts = api.split(' ', 1)
                    if len(parts) == 2:
                        result.append({'method': parts[0].upper(), 'path': parts[1], 'code': parts[1].split('/')[-1]})
                elif isinstance(api, dict):
                    result.append({'method': api.get('method', 'GET').upper(),
                                  'path': api.get('path', '/'),
                                  'code': api.get('code') or api.get('path', '/').split('/')[-1] or 'api'})
            return result
        except: return []
    
    def parse_list(t):
        if not t: return ['READY']
        try:
            if isinstance(t, list): return [str(s) for s in t]
            if isinstance(t, str): return json.loads(t) if t.startswith('[') else [s.strip() for s in t.split(',')]
        except: pass
        return ['READY']
    
    def parse_fields(t):
        if not t: return []
        try:
            fields = json.loads(t) if isinstance(t, str) else (t if isinstance(t, list) else [])
            result = []
            for f in fields:
                if isinstance(f, dict):
                    result.append({'fieldCode': f.get('fieldCode', f.get('code', 'field')),
                                 'fieldName': f.get('fieldName', f.get('label', '')),
                                 'dataType': (f.get('dataType', 'TEXT') or 'TEXT').upper(),
                                 'required': bool(f.get('required', False)),
                                 'options': f.get('options', [])})
                elif isinstance(f, str):
                    result.append({'fieldCode': f, 'fieldName': f, 'dataType': 'TEXT', 'required': False, 'options': []})
            return result
        except: return []
    
    def parse_sections(t):
        if not t: return [{'sectionCode': 'default', 'sectionName': 'Main', 'order': 1}]
        try:
            if isinstance(t, list): return t
            if isinstance(t, str): return json.loads(t) if t.startswith('[') else [{'sectionName': t}]
        except: pass
        return [{'sectionCode': 'default', 'sectionName': 'Main', 'order': 1}]
    
    return {
        'contract_id': data.get('contract_id'),
        'route_path': data.get('route_path', ''),
        'screen_name': data.get('screen_name', ''),
        'process_code': data.get('process_code', 'UNKNOWN'),
        'actor_code': data.get('actor_code', 'USER'),
        'api_contract': parse_api(data.get('api_contract')),
        'state_contract': parse_list(data.get('state_contract')),
        'fields': parse_fields(data.get('field_contract')),
        'sections': parse_sections(data.get('section_contract'))
    }

# ============================================================================
# Template Generation
# ============================================================================

def generate_templates():
    """Generate all base template files"""
    templates_dir = BASE_OUTPUT / "templates"
    templates_dir.mkdir(parents=True, exist_ok=True)
    
    files = []
    
    # types.ts
    types_code = '''// Auto-generated Types
export interface Contract { contract_id: number; route_path: string; screen_name: string; process_code: string; }
export interface Field { fieldCode: string; fieldName: string; dataType: string; required: boolean; options?: any[]; }
export interface Api { method: string; path: string; code: string; }
export type ScreenState = 'LOADING' | 'READY' | 'SAVING' | 'ERROR' | 'EMPTY';
'''
    files.append(write_file(templates_dir / "types.ts", types_code))
    
    # hooks.ts
    hooks_code = '''import { useState, useCallback } from 'react';

export const useScreenState = (initial = 'READY') => {
  const [state, setState] = useState(initial);
  return {
    state, setLoading: () => setState('LOADING'), setReady: () => setState('READY'),
    setSaving: () => setState('SAVING'), setError: (e) => setState('ERROR')
  };
};

export const useFormState = (init = {}) => {
  const [v, setV] = useState(init);
  return { values: v, handleChange: (k, val) => setV(p => ({ ...p, [k]: val })), setValues: setV };
};

export const useApi = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const request = async (fn) => {
    setLoading(true);
    try { return await fn(); }
    catch (e) { setError(e.message); return null; }
    finally { setLoading(false); }
  };
  return { loading, error, request };
};
'''
    files.append(write_file(templates_dir / "hooks.ts", hooks_code))
    
    # utils.ts
    utils_code = '''export const required = (v) => v ? null : 'Required';
export const email = (v) => v && !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(v) ? 'Invalid email' : null;
export const phone = (v) => v && !/^\\d{3}-\\d{4}-\\d{4}$/.test(v) ? 'Format: 010-0000-0000' : null;
export const min = (n) => (v) => v !== null && Number(v) < n ? `Min: ${n}` : null;
export const max = (n) => (v) => v !== null && Number(v) > n ? `Max: ${n}` : null;
'''
    files.append(write_file(templates_dir / "utils.ts", utils_code))
    
    # FieldFactory.tsx
    field_factory_code = '''import React, { useState } from 'react';
import { TextField, Select, MenuItem, FormControl, InputLabel, Checkbox, FormControlLabel, Switch, Radio, RadioGroup, FormLabel, Box, IconButton, InputAdornment } from '@mui/material';
import { Visibility, VisibilityOff } from '@mui/icons-material';

export const FieldFactory = ({ type, value, onChange, label, required, error, options = [], disabled = false, ...props }) => {
  const [show, setShow] = useState(false);
  const T = (type || 'TEXT').toUpperCase();
  const common = { disabled, error, fullWidth: true, size: 'small' };

  switch (T) {
    case 'TEXT': case 'EMAIL': case 'PHONE': case 'TEXTAREA':
      return <TextField {...common} type={T === 'PHONE' ? 'tel' : T === 'EMAIL' ? 'email' : 'text'} label={label} value={value || ''} onChange={e => onChange(e.target.value)} required={required} />;
    case 'NUMBER': case 'CALCULATED':
      return <TextField {...common} type="number" label={label} value={value ?? ''} onChange={e => onChange(parseFloat(e.target.value))} required={required} InputProps={{ readOnly: T === 'CALCULATED' }} />;
    case 'PASSWORD':
      return <TextField {...common} type={show ? 'text' : 'password'} label={label} value={value || ''} onChange={e => onChange(e.target.value)} required={required}
        InputProps={{ endAdornment: <InputAdornment><IconButton onClick={() => setShow(!show)} edge="end">{show ? <VisibilityOff /> : <Visibility />}</IconButton></InputAdornment> }} />;
    case 'DATE':
      return <TextField {...common} type="date" label={label} value={value ? value.split('T')[0] : ''} onChange={e => onChange(e.target.value ? new Date(e.target.value).toISOString() : null)} required={required} InputLabelProps={{ shrink: true }} />;
    case 'DATETIME':
      return <TextField {...common} type="datetime-local" label={label} value={value ? value.slice(0, 16) : ''} onChange={e => onChange(e.target.value ? new Date(e.target.value).toISOString() : null)} required={required} InputLabelProps={{ shrink: true }} />;
    case 'SELECT': case 'CODE': case 'ENUM':
      return <FormControl {...common} required={required}><InputLabel>{label}</InputLabel><Select value={value || ''} onChange={e => onChange(e.target.value)} label={label}>
        {options.map(o => <MenuItem key={o.value} value={o.value}><Box display="flex" justifyContent="space-between"><span>{o.label}</span><Box component="span" color="text.secondary" fontSize="small">{o.value}</Box></Box></MenuItem>)}
      </Select></FormControl>;
    case 'CHECKBOX':
      return <FormControlLabel control={<Checkbox checked={!!value} onChange={e => onChange(e.target.checked)} disabled={disabled} />} label={label} />;
    case 'SWITCH':
      return <FormControlLabel control={<Switch checked={!!value} onChange={e => onChange(e.target.checked)} disabled={disabled} />} label={label} />;
    case 'RADIO':
      return <FormControl {...common}><FormLabel>{label}</FormLabel><RadioGroup value={value || ''} onChange={e => onChange(e.target.value)}>
        {options.map(o => <FormControlLabel key={o.value} value={o.value} control={<Radio />} label={o.label} />)}
      </RadioGroup></FormControl>;
    case 'AUTOCOMPLETE':
      return <Autocomplete value={value} onChange={(_, v) => onChange(v)} options={options} getOptionLabel={o => typeof o === 'string' ? o : o.label || o.value}
        renderInput={params => <TextField {...params} label={label} />} />;
    case 'SLIDER':
      return <Box sx={{ width: '100%', px: 1 }}><Typography variant="caption">{label}</Typography><Slider value={value ?? 0} onChange={(_, v) => onChange(v)} disabled={disabled} /></Box>;
    case 'ADDRESS':
      return <TextField {...common} label={label} value={value?.base || value || ''} onChange={e => onChange({ base: e.target.value })} placeholder="Address" />;
    case 'HIDDEN':
      return <input type="hidden" value={value || ''} />;
    case 'FILE': case 'IMAGE':
      return <Box><Typography variant="body2">{value ? (typeof value === 'string' ? value.split('/').pop() : value.name) : 'No file'}</Typography><input type="file" accept={T === 'IMAGE' ? 'image/*' : undefined} onChange={e => onChange(e.target.files?.[0])} disabled={disabled} /></Box>;
    default:
      return <TextField {...common} label={label} value={value || ''} onChange={e => onChange(e.target.value)} required={required} />;
  }
};
export default FieldFactory;
'''
    files.append(write_file(templates_dir / "FieldFactory.tsx", field_factory_code))
    
    # SectionComponents.tsx
    section_code = '''import React, { useState } from 'react';
import { Card, CardHeader, CardContent, Box, Typography, IconButton, Chip } from '@mui/material';
import { ExpandMore } from '@mui/icons-material';

export const CardSection = ({ title, subtitle, children, actions, collapsible = false, defaultExpanded = true }) => {
  const [expanded, setExpanded] = useState(defaultExpanded);
  return (
    <Card sx={{ mb: 2 }}>
      <CardHeader title={title} subheader={subtitle}
        action={<Box display="flex" alignItems="center" gap={1}>{actions}
          {collapsible && <IconButton onClick={() => setExpanded(!expanded)} size="small"><ExpandMore sx={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: '0.2s' }} /></IconButton>}
        </Box>} />
      {expanded && <CardContent>{children}</CardContent>}
    </Card>
  );
};

export const StatusChip = ({ status }) => {
  const colors = { READY: 'success', LOADING: 'info', SAVING: 'warning', ERROR: 'error', EMPTY: 'default', SUBMITTED: 'success' };
  return <Chip label={status} color={colors[status] || 'default'} size="small" />;
};
'''
    files.append(write_file(templates_dir / "SectionComponents.tsx", section_code))
    
    # FormComponents.tsx
    form_code = '''import React from 'react';
import { Box, Button, Grid, Typography, Card, CardContent, IconButton, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@mui/material';
import { Add, Delete } from '@mui/icons-material';
import { FieldFactory } from './FieldFactory';
import { useFormState } from './hooks';

export const AutoForm = ({ fields, values = {}, onSubmit, readonly = false, columns = 2 }) => {
  const { values: formValues, handleChange } = useFormState(values);
  return (
    <Box>
      <Grid container spacing={2}>
        {fields.map(field => (
          <Grid item xs={12} md={12/columns} key={field.name}>
            <Typography variant="caption">{field.label}{field.required && <span style={{color:'red'}}> *</span>}</Typography>
            <FieldFactory type={field.type} value={formValues[field.name]} onChange={v => handleChange(field.name, v)} options={field.options} disabled={readonly} />
          </Grid>
        ))}
      </Grid>
      {!readonly && <Box display="flex" gap={1} justifyContent="flex-end" mt={3}><Button variant="contained" onClick={() => onSubmit?.(formValues)}>Save</Button></Box>}
    </Box>
  );
};

export const FormArray = ({ label, template, values = [], onChange, readonly = false, minItems = 0, maxItems = 10 }) => {
  const [items, setItems] = React.useState(values);
  const add = () => { if (items.length < maxItems) { const ni = {}; template.forEach(f => ni[f.name] = ''); const u = [...items, ni]; setItems(u); onChange?.(u); } };
  const remove = (i) => { if (items.length > minItems) { const u = items.filter((_, idx) => idx !== i); setItems(u); onChange?.(u); } };
  const update = (i, f, v) => { const u = [...items]; u[i] = { ...u[i], [f]: v }; setItems(u); onChange?.(u); };
  return (
    <Card sx={{ mb: 2 }}>
      <CardContent>
        <Box display="flex" justifyContent="space-between" mb={2}><Typography>{label} ({items.length})</Typography>
          {!readonly && <Button size="small" startIcon={<Add />} onClick={add} disabled={items.length >= maxItems}>Add</Button>}
        </Box>
        {items.length === 0 ? <Typography color="textSecondary">No items</Typography> : (
          <TableContainer><Table size="small">
            <TableHead><TableRow>{template.map(f => <TableCell key={f.name} sx={{ fontWeight: 'bold' }}>{f.label}</TableCell>)}</TableRow></TableHead>
            <TableBody>
              {items.map((item, i) => (
                <TableRow key={i}>
                  {template.map(f => <TableCell key={f.name}><FieldFactory type={f.type} value={item[f.name]} onChange={v => update(i, f.name, v)} options={f.options} disabled={readonly} size="small" /></TableCell>)}
                  {!readonly && <TableCell><IconButton size="small" onClick={() => remove(i)} disabled={items.length <= minItems}><Delete fontSize="small" /></IconButton></TableCell>}
                </TableRow>
              ))}
            </TableBody>
          </Table></TableContainer>
        )}
      </CardContent>
    </Card>
  );
};
'''
    files.append(write_file(templates_dir / "FormComponents.tsx", form_code))
    
    # api_client.ts
    api_code = '''import axios from 'axios';
const client = axios.create({ baseURL: '/api', timeout: 30000, headers: { 'Content-Type': 'application/json' } });
client.interceptors.request.use(config => { const token = localStorage.getItem('accessToken'); if (token) config.headers.Authorization = `Bearer ${token}`; return config; });
client.interceptors.response.use(r => r, error => { if (error.response?.status === 401) { localStorage.clear(); window.location.href = '/login'; } return Promise.reject(error); });
export const api = {
  get: <T = any>(url, params?) => client.get(url, { params }).then(r => r.data),
  post: <T = any>(url, data?) => client.post(url, data).then(r => r.data),
  put: <T = any>(url, data?) => client.put(url, data).then(r => r.data),
  patch: <T = any>(url, data?) => client.patch(url, data).then(r => r.data),
  delete: <T = any>(url) => client.delete(url).then(r => r.data),
};
export default client;
'''
    files.append(write_file(templates_dir / "api_client.ts", api_code))
    
    # screen_registry.ts
    registry_code = '''import React from 'react';
export const screenRegistry = {};
export const registerScreen = (key, component, route, screenName, contractId) => { screenRegistry[key] = { component, route, screenName, contractId }; };
export const getScreen = (key) => screenRegistry[key];
export const generateRouteConfig = () => Object.entries(screenRegistry).map(([k, v]) => ({ path: v.route, element: React.createElement(v.component), key: k }));
'''
    files.append(write_file(templates_dir / "screen_registry.ts", registry_code))
    
    # runtime index
    runtime_idx = '''// Runtime Index
export * from './types';
export * from './hooks';
export * from './utils';
export * from './FieldFactory';
export * from './FormComponents';
export * from './SectionComponents';
export * from './api_client';
export * from './screen_registry';
'''
    files.append(write_file(templates_dir / "index.ts", runtime_idx))
    
    return files

def write_file(path: Path, content: str) -> Path:
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    return path

# ============================================================================
# Screen Composer
# ============================================================================

def compose_screens(contracts: List[Dict], progress_callback=None) -> List[Dict]:
    """Compose all screens from contracts"""
    screens_dir = BASE_OUTPUT / "screens"
    screens_dir.mkdir(parents=True, exist_ok=True)
    
    generated = []
    errors = []
    
    for i, c in enumerate(contracts):
        try:
            result = compose_single_screen(c, screens_dir)
            generated.append(result)
        except Exception as e:
            errors.append({'contract_id': c.get('contract_id'), 'error': str(e)})
        
        if progress_callback and (i + 1) % 100 == 0:
            progress_callback(i + 1, len(contracts))
    
    if progress_callback:
        progress_callback(len(contracts), len(contracts))
    
    return generated

def compose_single_screen(contract: Dict, output_dir: Path) -> Dict:
    cid = contract.get('contract_id')
    screen = contract.get('screen_name', f'Screen_{cid}')
    route = contract.get('route_path', f'/screen/{cid}')
    fields = contract.get('fields', [])[:15]
    sections = contract.get('sections', [{'sectionName': 'Main'}])
    apis = contract.get('api_contract', [])
    
    # Clean component name
    clean = re.sub(r'[^\w\s\uAC00-\uD7A3]', '', screen)
    clean = clean[:30] if len(clean) > 30 else clean
    clean = clean.replace(' ', '')
    comp_name = f"C{cid}_{clean}" if clean else f"C{cid}"
    
    code = generate_screen_code(comp_name, cid, screen, route, fields, sections, apis)
    
    filepath = output_dir / f"{comp_name}Screen.tsx"
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(code)
    
    return {
        'contract_id': cid,
        'component': f"{comp_name}Screen",
        'route': route,
        'file': str(filepath),
        'field_count': len(fields),
        'section_count': len(sections)
    }

def generate_screen_code(comp_name: str, cid: int, screen: str, route: str, fields: List[Dict], sections: List[Dict], apis: List[Dict]) -> str:
    """Generate screen component code"""
    
    # API comments
    api_lines = '\n'.join([f"// {a.get('method', 'GET')} {a.get('path', '/')}" for a in apis[:4]])
    
    # Field grid items
    field_items = []
    for f in fields:
        fc = f.get('fieldCode', 'field')
        fl = f.get('fieldName', fc)
        ft = f.get('dataType', 'TEXT')
        fr = f.get('required', False)
        opts = f.get('options', [])
        
        # Options for select types
        opt_code = ""
        if opts:
            opt_list = ', '.join([f'{{value: "{o.get("value", o)}", label: "{o.get("label", o)}"}}' for o in opts])
            opt_code = f'const {fc}Options = [{opt_list}];'
        
        # Required marker
        req_marker = "\\n            {" + f"' ' + ({fr} ? <Typography component=\"span\" color=\"error\"> *</Typography> : null)" + "}"
        
        field_items.append(f'''
          <Grid item xs={{12}} md={{6}} key="{fc}">
            <Typography variant="caption" sx={{ display: 'block' }}>
              {fl}
            </Typography>
            {opt_code}
            <FieldFactory type="{ft}" value={{formData.{fc}}} onChange={{v => handleChange('{fc}', v)}} options={{{fc}Options}} />
          </Grid>''')
    
    # Section tabs
    tab_items = ''
    has_tabs = len(sections) > 1
    if has_tabs:
        tabs = '\n'.join([f'              <Tab key={i} label="{s.get("sectionName", f"Section {i+1}")}" />' for i, s in enumerate(sections[:5])])
        tab_items = f'''
          <Paper sx={{ mb: 2 }}>
            <Tabs value={{activeTab}} onChange={{(_, v) => setActiveTab(v)}}>
              {tabs}
            </Tabs>
          </Paper>'''
    
    # Build code
    code = f'''/**
 * Screen: {screen}
 * Contract: #{cid} | Route: {route}
 * Generated: {datetime.now().isoformat()}
 */

import React, {{ useState, useEffect }} from "react";
import {{ Card, CardHeader, CardContent, TextField, Button, Grid, Box, Typography, Alert, CircularProgress, Tabs, Tab, Paper }} from "@mui/material";
import {{ Save, Refresh }} from "@mui/icons-material";
import {{ useNavigate }} from "react-router-dom";
import {{ api, useScreenState, useFormState }} from "../templates/hooks";
import {{ FieldFactory, CardSection, StatusChip }} from "../templates/FieldFactory";

{api_lines}

export const {comp_name}Screen = () => {{
  const navigate = useNavigate();
  const {{ state, setLoading, setReady, setSaving, setError }} = useScreenState();
  const {{ values: formData, handleChange, setValues }} = useFormState();

  const [activeTab, setActiveTab] = useState(0);
  const [tableData, setTableData] = useState<any[]>([]);

  useEffect(() => {{
    setReady();
    loadData();
  }}, []);

  const loadData = useCallback(async () => {{
    setLoading();
    try {{
      // TODO: Replace with actual API call
      // const result = await api.get("{route}");
      setTableData([]);
      setReady();
    }} catch (err) {{
      setError(err.message);
    }}
  }}, []);

  const handleSubmit = async () => {{
    setSaving();
    try {{
      // TODO: Replace with actual API call
      // await api.post("{route}", formData);
      setReady();
      navigate(-1);
    }} catch (err) {{
      setError(err.message);
    }}
  }};

  const handleChange = (field: string, value: any) => {{
    setValues((prev: any) => ({{ ...prev, [field]: value }}));
  }};

  return (
    <Box sx={{ p: 3 }}>
      <!-- Header -->
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5">{screen}</Typography>
        <Box display="flex" gap={1} alignItems="center">
          <StatusChip status={{state}} />
          <Button startIcon=<Refresh /> onClick={{loadData}} size="small">Refresh</Button>
        </Box>
      </Box>

      <!-- Loading -->
      {{state === "LOADING" && (
        <Box display="flex" justifyContent="center" py={5}>
          <CircularProgress />
        </Box>
      )}}

      <!-- Error -->
      {{state === "ERROR" && (
        <Alert severity="error" onClose={{() => setReady()}}>An error occurred</Alert>
      )}}

      <!-- Content -->
      {{state !== "LOADING" && (
        <Box>
          <!-- comment -->
           {{has_tabs && tab_items}}
           {{!has_tabs && <Box mb={2} />}}

          <!-- comment -->
          <CardSection title={{screen}}>
            <Grid container spacing={2}>
              {{field_items}}
            </Grid>
          </CardSection>

          <!-- comment -->
          <Paper sx={{ p: 2, mt: 2 }}>
            <Box display="flex" gap={1} justifyContent="flex-end">
              <Button variant="outlined" onClick={{() => navigate(-1)}}>Cancel</Button>
              <Button variant="outlined" onClick={{() => setValues({{}})}}>Reset</Button>
              <Button variant="contained" startIcon=<Save /> onClick={{handleSubmit}}>Save</Button>
            </Box>
          </Paper>
        </Box>
      )}}
    </Box>
  );
}};

export default {comp_name}Screen;
'''
    
    # Fix the has_tabs reference in the code
    code = code.replace('{tab_items}', tab_items)
    code = code.replace('{{has_tabs && ', '').replace('{!has_tabs && ', '')
    
    return code

# ============================================================================
# Export
# ============================================================================

def export_screens(screens: List[Dict]):
    """Export screens with index and routes"""
    
    # Index file
    imports = '\n'.join([f"import {{ {s['component']} }} from './screens/{s['component']}';" for s in screens[:100]])
    exports = '\n'.join([f"  {s['component']}: {s['component']}," for s in screens[:100]])
    
    index_code = f'''// Screen Index
{imports}

export const screens = {{
{exports}
}};
'''
    write_file(BASE_OUTPUT / "index.tsx", index_code)
    
    # Routes
    routes_code = '''// Auto-generated Routes\nimport React from 'react';\nimport { Routes, Route } from 'react-router-dom';\n''' + imports + '''\n\nexport const AppRoutes = () => (\n  <Routes>\n    {screens.map(s => <Route key={s.contract_id} path={s.route} element={<s.component />} />)}\n  </Routes>\n);\n'''\n    write_file(BASE_OUTPUT / "routes.tsx", routes_code)
    
    # Catalog
    catalog = {
        'generated_at': datetime.now().isoformat(),
        'total_screens': len(screens),
        'screens': [{'id': s['contract_id'], 'component': s['component'], 'route': s['route']} for s in screens]
    }
    write_file(BASE_OUTPUT / "catalog.json", json.dumps(catalog, ensure_ascii=False, indent=2))
    
    return {'index': True, 'routes': True, 'catalog': True}

# ============================================================================
# Main
# ============================================================================

def run():
    print(f"\n{'='*70}")
    print("MASTER GENERATOR v4 - Mass Screen Generation")
    print(f"Output: {BASE_OUTPUT}")
    print(f"{'='*70}")
    
    start_time = time.time()
    
    # Layer 1: Extract
    print("\n[LAYER 1] Extracting contracts...")
    contracts = extract_contracts()
    print(f"  Extracted: {len(contracts)} contracts")
    
    # Layer 2: Validate
    print("\n[LAYER 2] Validating...")
    valid = [c for c in contracts if c.get('route_path')]
    print(f"  Valid: {len(valid)} contracts")
    
    # Layer 3: Templates
    print("\n[LAYER 3] Generating templates...")
    template_files = generate_templates()
    print(f"  Generated: {len(template_files)} template files")
    
    # Layer 4: Compose
    print("\n[LAYER 4] Composing screens...")
    def progress(current, total):
        print(f"  Progress: {current}/{total} ({100*current//total}%)")
    
    screens = compose_screens(valid, progress_callback=progress)
    print(f"  Composed: {len(screens)} screens")
    
    # Layer 5: Export
    print("\n[LAYER 5] Exporting...")
    export_result = export_screens(screens)
    print(f"  Exported: {export_result}")
    
    total_time = time.time() - start_time
    
    print(f"\n{'='*70}")
    print("COMPLETED")
    print(f"  Total time: {total_time:.2f}s")
    print(f"  Contracts: {len(contracts)}")
    print(f"  Screens: {len(screens)}")
    print(f"  Templates: {len(template_files)}")
    print(f"{'='*70}")
    
    return {
        'contracts': len(contracts),
        'screens': len(screens),
        'templates': len(template_files),
        'duration': total_time
    }

if __name__ == "__main__":
    result = run()
    print(f"\nResult: {json.dumps(result, indent=2)}")

  const update = (i, f, v) => { const u = [...items]; u[i] = { ...u[i], [f]: v }; setItems(u); onChange?.(u); };
  return (
    <Card sx={{ mb: 2 }}>
      <CardContent>
        <Box display="flex" justifyContent="space-between" mb={2}><Typography>{label} ({items.length})</Typography>
          {!readonly && <Button size="small" startIcon={<Add />} onClick={add} disabled={items.length >= maxItems}>Add</Button>}
        </Box>
        {items.length === 0 ? <Typography color="textSecondary">No items</Typography> : (
          <TableContainer><Table size="small">
            <TableHead><TableRow>{template.map(f => <TableCell key={f.name} sx={{ fontWeight: 'bold' }}>{f.label}</TableCell>)}</TableRow></TableHead>
            <TableBody>
              {items.map((item, i) => (
                <TableRow key={i}>
                  {template.map(f => <TableCell key={f.name}><FieldFactory type={f.type} value={item[f.name]} onChange={v => update(i, f.name, v)} options={f.options} disabled={readonly} size="small" /></TableCell>)}
                  {!readonly && <TableCell><IconButton size="small" onClick={() => remove(i)} disabled={items.length <= minItems}><Delete fontSize="small" /></IconButton></TableCell>}
                </TableRow>
              ))}
            </TableBody>
          </Table></TableContainer>
        )}
      </CardContent>
    </Card>
  );
};
''')

    write_file(templates_dir / "api_client.ts", '''import axios from 'axios';
const client = axios.create({ baseURL: '/api', timeout: 30000 });
client.interceptors.request.use(cfg => { const t = localStorage.getItem('accessToken'); if (t) cfg.headers.Authorization = `Bearer ${t}`; return cfg; });
client.interceptors.response.use(r => r, e => { if (e.response?.status === 401) { localStorage.clear(); window.location.href = '/login'; } return Promise.reject(e); });
export const api = { get: <T=u>(u, p?) => client.get(u, {params: p}).then(r => r.data), post: <T=u>(u, d?) => client.post(u, d).then(r => r.data), put: <T=u>(u, d?) => client.put(u, d).then(r => r.data), delete: <T=u>(u) => client.delete(u).then(r => r.data) };
export default client;
''')

    write_file(templates_dir / "screen_registry.ts", '''import React from 'react';
export const screenRegistry = {};
export const registerScreen = (k, c, r, s, id) => { screenRegistry[k] = { component: c, route: r, screenName: s, contractId: id }; };
export const getScreen = k => screenRegistry[k];
export const generateRouteConfig = () => Object.entries(screenRegistry).map(([k, v]) => ({ path: v.route, element: React.createElement(v.component), key: k }));
''')

    write_file(templates_dir / "index.ts", '''export * from './types';
export * from './hooks';
export * from './utils';
export * from './FieldFactory';
export * from './SectionComponents';
export * from './FormComponents';
export * from './api_client';
export * from './screen_registry';
''')

    return list(templates_dir.glob('*'))


# ============================================================================
# Screen Composer
# ============================================================================

def compose_screens(contracts, progress_cb=None):
    screens_dir = BASE_OUTPUT / "screens"
    screens_dir.mkdir(parents=True, exist_ok=True)
    generated = []
    for i, c in enumerate(contracts):
        try:
            result = compose_single_screen(c, screens_dir)
            generated.append(result)
        except Exception as e:
            print(f"  Error {c.get('contract_id')}: {e}")
        if progress_cb and (i + 1) % 100 == 0:
            progress_cb(i + 1, len(contracts))
    if progress_cb:
        progress_cb(len(contracts), len(contracts))
    return generated

def compose_single_screen(contract, output_dir):
    cid = contract.get('contract_id')
    screen = contract.get('screen_name', f'Screen_{cid}')
    route = contract.get('route_path', f'/screen/{cid}')
    fields = contract.get('fields', [])[:15]
    sections = contract.get('sections', [{'sectionName': 'Main'}])
    apis = contract.get('api_contract', [])

    clean = re.sub(r'[^\w\s\uAC00-\uD7A3]', '', screen)
    clean = (clean[:30] if len(clean) > 30 else clean).replace(' ', '')
    comp_name = f"C{cid}_{clean}" if clean else f"C{cid}"

    code = generate_screen(comp_name, cid, screen, route, fields, sections, apis)
    filepath = output_dir / f"{comp_name}Screen.tsx"
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(code)

    return {'contract_id': cid, 'component': f"{comp_name}Screen", 'route': route, 'file': str(filepath), 'field_count': len(fields)}

def generate_screen(comp_name, cid, screen, route, fields, sections, apis):
    """Generate screen - using string building to avoid f-string JSX issues"""
    
    # Build API comment lines
    api_lines = '\n'.join([f"// {a.get('method', 'GET')} {a.get('path', '/')}" for a in apis[:4]])
    
    # Build field items
    field_items = []
    for f in fields:
        fc = f.get('fieldCode', 'field')
        fl = f.get('fieldName', fc)
        ft = f.get('dataType', 'TEXT')
        fr = f.get('required', False)
        opts = f.get('options', [])
        
        opt_code = ""
        if opts:
            opt_list = ', '.join([f'{{value: "{o.get("value", o)}", label: "{o.get("label", o)}"}}' for o in opts])
            opt_code = f'const {fc}Options = [{opt_list}];'
        
        req = " *" if fr else ""
        
        field_items.append(f'''<Grid item xs={{12}} md={{6}} key="{fc}">
            <Typography variant="caption">{fl}{req}</Typography>
            {opt_code}
            <FieldFactory type="{ft}" value={{formData.{fc}}} onChange={{v => handleChange('{fc}', v)}} options={{{fc}Options}} />
          </Grid>''')
    
    # Section tabs
    tab_section = ""
    has_tabs = len(sections) > 1
    if has_tabs:
        tabs = '\n'.join([f'<Tab key={i} label="{s.get("sectionName", f"Section {i+1}")}" />' for i, s in enumerate(sections[:5])])
        tab_section = f'''<Paper sx={{ mb: 2 }}>
            <Tabs value={{activeTab}} onChange={{(_, v) => setActiveTab(v)}}>
              {tabs}
            </Tabs>
          </Paper>'''
    
    # Build code using string concatenation
    code = '''/**
 * Screen: ''' + screen + '''
 * Contract: #''' + str(cid) + ''' | Route: ''' + route + '''
 * Generated: ''' + datetime.now().isoformat() + '''
 */

import React, { useState, useEffect, useCallback } from "react";
import { Card, CardHeader, CardContent, TextField, Button, Grid, Box, Typography, Alert, CircularProgress, Tabs, Tab, Paper } from "@mui/material";
import { Save, Refresh } from "@mui/icons-material";
import { useNavigate } from "react-router-dom";
import { api, useScreenState, useFormState } from "../templates/hooks";
import { FieldFactory, CardSection, StatusChip } from "../templates/FieldFactory";

''' + api_lines + '''

export const ''' + comp_name + '''Screen = () => {
  const navigate = useNavigate();
  const { state, setLoading, setReady, setSaving, setError } = useScreenState();
  const { values: formData, handleChange, setValues } = useFormState();

  const [activeTab, setActiveTab] = useState(0);

  useEffect(() => {
    setReady();
  }, []);

  const handleSubmit = async () => {
    setSaving();
    try {
      setReady();
      navigate(-1);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleChange = (field, value) => {
    setValues(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5">''' + screen + '''</Typography>
        <Box display="flex" gap={1} alignItems="center">
          <StatusChip status={{state}} />
        </Box>
      </Box>

      {state === "LOADING" && (
        <Box display="flex" justifyContent="center" py={5}>
          <CircularProgress />
        </Box>
      )}

      {state === "ERROR" && (
        <Alert severity="error" onClose={() => setReady()}>An error occurred</Alert>
      )}

      {state !== "LOADING" && (
        <Box>
          ''' + (tab_section if has_tabs else "<Box mb={2} />") + '''

          <CardSection title="''' + screen + '''">
            <Grid container spacing={2}>
              ''' + '\n              '.join(field_items) + '''
            </Grid>
          </CardSection>

          <Paper sx={{ p: 2, mt: 2 }}>
            <Box display="flex" gap={1} justifyContent="flex-end">
              <Button variant="outlined" onClick={() => navigate(-1)}>Cancel</Button>
              <Button variant="outlined" onClick={() => setValues({})}>Reset</Button>
              <Button variant="contained" startIcon={<Save />} onClick={handleSubmit}>Save</Button>
            </Box>
          </Paper>
        </Box>
      )}
    </Box>
  );
};

export default ''' + comp_name + '''Screen;
'''
    return code


# ============================================================================
# Export
# ============================================================================

def export_screens(screens):
    # Index
    imports = '\n'.join([f"import {{ {s['component']} }} from './screens/{s['component']}';" for s in screens[:100]])
    exports = '\n'.join([f"  {s['component']}: {s['component']}," for s in screens[:100]])
    
    idx = f'''// Screen Index
{imports}

export const screens = {{
{exports}
}};
'''
    write_file(BASE_OUTPUT / "index.tsx", idx)
    
    # Routes
    routes = f'''// Routes
import React from 'react';
import {{ Routes, Route }} from 'react-router-dom';
{imports}

export const AppRoutes = () => (
  <Routes>
    {screens.map(s => <Route key={{{s.contract_id}}} path={{{s.route}}} element={<s.component />} />)}
  </Routes>
);
'''
    write_file(BASE_OUTPUT / "routes.tsx", routes)
    
    # Catalog
    cat = {'generated_at': datetime.now().isoformat(), 'total': len(screens),
           'screens': [{'id': s['contract_id'], 'component': s['component'], 'route': s['route']} for s in screens]}
    write_file(BASE_OUTPUT / "catalog.json", json.dumps(cat, ensure_ascii=False, indent=2))
    
    return {'index': True, 'routes': True, 'catalog': True}


# ============================================================================
# Main
# ============================================================================

def run():
    print(f"\n{'='*70}")
    print("MASTER GENERATOR v4 - Mass Screen Generation")
    print(f"Output: {BASE_OUTPUT}")
    print(f"{'='*70}")
    
    start = time.time()
    
    # Layer 1: Extract
    print("\n[1] Extracting contracts...")
    contracts = extract_contracts()
    print(f"    Extracted: {len(contracts)} contracts")
    
    # Layer 2: Validate
    print("\n[2] Validating...")
    valid = [c for c in contracts if c.get('route_path')]
    print(f"    Valid: {len(valid)} contracts")
    
    # Layer 3: Templates
    print("\n[3] Generating templates...")
    template_files = generate_templates()
    print(f"    Generated: {len(template_files)} files")
    
    # Layer 4: Compose
    print("\n[4] Composing screens...")
    def progress(c, t):
        if c % 100 == 0 or c == t:
            print(f"    Progress: {c}/{t} ({100*c//t}%)")
    
    screens = compose_screens(valid, progress_cb=progress)
    print(f"    Composed: {len(screens)} screens")
    
    # Layer 5: Export
    print("\n[5] Exporting...")
    export_screens(screens)
    
    total = time.time() - start
    
    print(f"\n{'='*70}")
    print("COMPLETED")
    print(f"  Duration: {total:.2f}s")
    print(f"  Contracts: {len(contracts)}")
    print(f"  Screens: {len(screens)}")
    print(f"  Templates: {len(template_files)}")
    print(f"{'='*70}")
    
    return {'contracts': len(contracts), 'screens': len(screens), 'templates': len(template_files), 'duration': total}

if __name__ == "__main__":
    result = run()
    print(f"\nResult: {json.dumps(result, indent=2)}")
