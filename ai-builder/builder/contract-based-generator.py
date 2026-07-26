#!/usr/bin/env python3
"""Contract-based Screen Code Generator - Unique naming with contract_id"""
import json, os, re, subprocess, sys
from datetime import datetime

OUTPUT_DIR = '/tmp/contract-based-screens'
LIMIT = int(sys.argv[1]) if len(sys.argv) > 1 else 50

os.makedirs(OUTPUT_DIR, exist_ok=True)

def db_query(sql):
    cmd = [
        "kubectl", "exec", "postgres-patroni-1", "-n", "carbonet-prod",
        "--", "psql", "-h", "127.0.0.1", "-U", "postgres", "-d", "carbonet",
        "-t", "-A", "-c", sql
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
    return result.stdout

def extract_contracts(limit):
    sql = """
    SELECT c.contract_id, c.route_path, c.screen_name, c.process_code,
           c.step_code, c.actor_code,
           COALESCE(c.business_purpose, '') as bp,
           COALESCE(c.entry_condition, '') as ec,
           COALESCE(c.exit_condition, '') as xc,
           COALESCE(c.api_contract, '[]') as ac,
           COALESCE(c.state_contract, '[]') as sc,
           COALESCE(c.field_contract, '[]') as fc
    FROM framework_professional_screen_contract c
    WHERE c.contract_status IN ('VERIFIED', 'DESIGN_COMPLETE')
    ORDER BY c.contract_id
    LIMIT """ + str(limit)
    
    output = db_query(sql)
    contracts = []
    
    for line in output.strip().split('\n'):
        if '|' not in line:
            continue
        parts = line.split('|')
        if len(parts) < 12:
            continue
        try:
            c = {
                'contract_id': int(parts[0]),
                'route_path': parts[1],
                'screen_name': parts[2],
                'process_code': parts[3] or 'UNKNOWN',
                'step_code': parts[4] or 'UNKNOWN',
                'actor_code': parts[5] or 'USER',
                'business_purpose': parts[6],
                'entry_condition': parts[7],
                'exit_condition': parts[8],
                'api_contract': parse_apis(parts[9]),
                'state_contract': json.loads(parts[10]) if parts[10] else [],
                'field_contract': json.loads(parts[11]) if parts[11] else []
            }
            contracts.append(c)
        except Exception as e:
            continue
    
    print("Extracted " + str(len(contracts)) + " contracts")
    return contracts

def parse_apis(text):
    if not text:
        return []
    try:
        apis = json.loads(text)
    except:
        return []
    
    result = []
    for api in apis:
        if isinstance(api, str):
            parts = api.split(' ', 1)
            if len(parts) == 2:
                result.append({'method': parts[0], 'path': parts[1], 'code': parts[1].split('/')[-1] or parts[0]})
            else:
                result.append({'method': 'GET', 'path': api, 'code': api})
        elif isinstance(api, dict):
            result.append({
                'method': api.get('method', 'GET'),
                'path': api.get('path', '/'),
                'code': api.get('code') or api.get('path', '/').split('/')[-1] or 'API'
            })
    return result

def make_component_name(screen_name, contract_id):
    """Make unique component name with contract_id"""
    name = re.sub(r'[^\w\s]', '', screen_name)
    name = ''.join(w.title() for w in name.split())
    # Add contract_id for uniqueness
    return f"C{contract_id}_{name}Screen"

def generate_page(contract, output_dir):
    cid = contract['contract_id']
    route = contract['route_path']
    screen = contract['screen_name']
    process = contract['process_code']
    actor = contract['actor_code']
    apis = contract['api_contract']
    states = contract['state_contract']
    fields = contract['field_contract']
    
    comp_name = make_component_name(screen, cid)
    state_list = ', '.join(states[:6]) if states else 'READY'
    
    api_lines = ["// APIs for Contract #" + str(cid)]
    call_lines = []
    for api in apis[:6]:
        method = api.get('method', 'GET')
        path = api.get('path', '/')
        code = api.get('code', '?')
        api_lines.append("// " + code + ": " + method + " " + path)
        if method == 'GET':
            call_lines.append("      // GET: " + code)
            call_lines.append("      var r = await fetch('" + path + "');")
            call_lines.append("      var d = await r.json(); setData(d);")
        elif method == 'POST':
            call_lines.append("      // POST: " + code)
            call_lines.append("      var r = await fetch('" + path + "',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(formData)});")
            call_lines.append("      var d = await r.json();")
    
    if fields:
        field_lines = ["        <Grid container spacing={2}>"]
        for f in fields[:10]:
            fc = f.get('code', 'field')
            fl = f.get('label', fc)
            ft = f.get('type', 'text')
            fr = 'true' if f.get('required') else 'false'
            field_lines.append('          <Grid item xs={12} md={6} key="' + fc + '">')
            # Escape field code for JS string and use bracket notation
            fc_escaped = fc.replace("'", "\\'")
            field_lines.append('            <TextField label="' + fl + '" type="' + ft + '" fullWidth required={' + fr + '} value={formData[\'' + fc_escaped + '\']||\'\'} onChange={(e)=>setFormData({...formData,\'' + fc_escaped + '\':e.target.value})} />')
            field_lines.append('          </Grid>')
        field_lines.append("        </Grid>")
        field_section = '\n'.join(field_lines)
    else:
        field_section = '        <TextField label="Sample" fullWidth value={formData.sample||\'\'} onChange={(e)=>setFormData({...formData,sample:e.target.value})} />'
    
    code = '''/**
 * Contract: ''' + str(cid) + ''' | Route: ''' + route + '''
 * Process: ''' + process + ''' | Actor: ''' + actor + '''
 * Generated: ''' + datetime.now().isoformat() + '''
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, TextField, Button, Grid, Box, Typography, Alert, CircularProgress, Divider } from '@mui/material';
import { Save, Cancel, Refresh } from '@mui/icons-material';

''' + '\n'.join(api_lines) + '''

export const ''' + comp_name + ''' = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [screenState, setScreenState] = useState('LOADING');
  const [formData, setFormData] = useState({});

  // States: ''' + state_list + '''

  useEffect(() => { setScreenState('READY'); }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
''' + '\n'.join(call_lines) + '''
    } catch (err) {
      setError(err.message); setScreenState('ERROR');
    } finally { setLoading(false); }
  }, []);

  const handleSubmit = async () => {
    setLoading(true);
    try { await loadData(); setScreenState('SAVED'); }
    catch (err) { setError(err.message); setScreenState('ERROR'); }
    finally { setLoading(false); }
  };

  return (
    <Card>
      <CardHeader title="''' + screen + '''" subheader="Contract-based Generated" />
      <CardContent>
        {screenState === 'LOADING' && <Box display="flex" justifyContent="center"><CircularProgress /></Box>}
        {error && <Alert severity="error">{error}</Alert>}
        {!error && screenState !== 'LOADING' && (
          <Box>
            <Typography variant="body2" color="textSecondary">
              Process: ''' + process + ''' | Actor: ''' + actor + ''' | Contract: #''' + str(cid) + '''
            </Typography>
            <Divider sx={{ my: 2 }} />
            ''' + field_section + '''
            <Divider sx={{ my: 2 }} />
            <Box display="flex" gap={1}>
              <Button variant="contained" onClick={handleSubmit} disabled={loading}>저장</Button>
              <Button variant="outlined" onClick={() => navigate(-1)}>취소</Button>
              <Button variant="text" onClick={loadData}>새로고침</Button>
            </Box>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default ''' + comp_name + ''';
'''
    
    filepath = os.path.join(output_dir, comp_name + ".tsx")
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(code)
    
    return {
        'contract_id': cid,
        'route': route,
        'screen_name': screen,
        'component': comp_name,
        'file': comp_name + ".tsx"
    }

def main():
    global OUTPUT_DIR, LIMIT
    if len(sys.argv) > 2:
        OUTPUT_DIR = sys.argv[2]
    if len(sys.argv) > 1:
        LIMIT = int(sys.argv[1])
    
    print("=" * 60)
    print("Contract-based Screen Generator v2 (Unique Names)")
    print("=" * 60)
    print("Limit: " + str(LIMIT) + " | Output: " + OUTPUT_DIR)
    
    print("\n[1/3] Extracting contracts...")
    contracts = extract_contracts(LIMIT)
    if not contracts:
        print("ERROR: No contracts!")
        return
    
    print("\n[2/3] Generating " + str(len(contracts)) + " pages...")
    results = []
    for i, c in enumerate(contracts):
        r = generate_page(c, OUTPUT_DIR)
        results.append(r)
        if (i + 1) % 100 == 0:
            print("  " + str(i + 1) + "/" + str(len(contracts)))
    
    print("\n[3/3] Saving catalog...")
    catalog = {
        'generated_at': datetime.now().isoformat(),
        'total': len(results),
        'screens': results
    }
    with open(os.path.join(OUTPUT_DIR, 'catalog.json'), 'w', encoding='utf-8') as f:
        json.dump(catalog, f, ensure_ascii=False, indent=2)
    
    # Verify uniqueness
    names = [r['component'] for r in results]
    print("\nUnique names: " + str(len(set(names))) + "/" + str(len(names)))
    
    print("\n" + "=" * 60)
    print("Done! " + str(len(results)) + " screens -> " + OUTPUT_DIR)
    print("=" * 60)
    for r in results[:5]:
        print("  " + r['file'] + " -> " + r['route'])

if __name__ == "__main__":
    main()
