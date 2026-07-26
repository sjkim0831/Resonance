"""Screen Composer - Generate screens from contracts + templates"""

import re
from pathlib import Path
from typing import Dict, List, Any, Optional
from datetime import datetime

class ScreenComposer:
    """Compose individual screen components from contracts"""
    
    def __init__(self, output_dir: Path, batch_size: int = 50):
        self.output_dir = output_dir / "screens"
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.batch_size = batch_size
        self.generated: List[Dict] = []
        self.errors: List[Dict] = []
    
    def compose_all(self, contracts: List[Dict], progress_callback=None) -> List[Dict]:
        """Compose all screens with batching for memory efficiency"""
        total = len(contracts)
        results = []
        
        for i, contract in enumerate(contracts):
            try:
                result = self._compose_screen(contract)
                results.append(result)
                self.generated.append(result)
            except Exception as e:
                error = {'contract_id': contract.get('contract_id'), 'error': str(e)}
                self.errors.append(error)
                results.append({'success': False, 'contract_id': contract.get('contract_id'), 'error': str(e)})
            
            if progress_callback and (i + 1) % 100 == 0:
                progress_callback(i + 1, total)
        
        if progress_callback:
            progress_callback(total, total)
        
        return results
    
    def _compose_screen(self, contract: Dict) -> Dict:
        """Compose single screen from contract"""
        cid = contract.get('contract_id')
        screen = contract.get('screen_name', f'Screen_{cid}')
        route = contract.get('route_path', f'/screen/{cid}')
        process = contract.get('process_code', 'UNKNOWN')
        actor = contract.get('actor_code', 'USER')
        fields = contract.get('fields', [])
        sections = contract.get('sections', [{'sectionCode': 'default', 'sectionName': 'Main'}])
        apis = contract.get('api_contract', [])
        states = contract.get('state_contract', ['READY'])
        
        # Generate component name
        comp_name = self._to_component_name(cid, screen)
        
        # Generate screen code
        code = self._generate_screen_code(
            comp_name, cid, screen, route, process, actor,
            fields, sections, apis, states
        )
        
        # Write to file
        filepath = self.output_dir / f"{comp_name}Screen.tsx"
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(code)
        
        return {
            'success': True,
            'contract_id': cid,
            'component': f"{comp_name}Screen",
            'route': route,
            'file': str(filepath),
            'field_count': len(fields),
            'section_count': len(sections)
        }
    
    def _to_component_name(self, cid: int, screen: str) -> str:
        """Convert contract to component name"""
        # Remove special characters, keep Korean and alphanumeric
        cleaned = re.sub(r'[^\w\s\uAC00-\uD7A3]', '', screen)
        # Truncate if too long
        if len(cleaned) > 30:
            cleaned = cleaned[:30]
        return f"C{cid}_{cleaned}" if cleaned else f"C{cid}"
    
    def _generate_screen_code(
        self, comp_name: str, cid: int, screen: str, route: str,
        process: str, actor: str, fields: List[Dict], sections: List[Dict],
        apis: List[Dict], states: List[str]
    ) -> str:
        """Generate complete screen component code"""
        
        # Generate field imports
        field_imports = "TextField, Select, MenuItem, FormControl, InputLabel, Checkbox, FormControlLabel, Switch, Radio, RadioGroup, FormLabel"
        
        # Generate API comment section
        api_lines = []
        for api in apis[:6]:
            method = api.get('method', 'GET')
            path = api.get('path', '/')
            code = api.get('code', 'api')
            api_lines.append(f"// {method} {path} ({code})")
        
        # Generate state options
        state_options = ', '.join([f"'{s}'" for s in states[:6]]) if states else "'READY'"
        
        # Generate field definitions for form
        field_defs = []
        field_items = []
        for i, f in enumerate(fields[:15]):  # Limit to 15 fields per screen
            fc = f.get('fieldCode', f'field{i}')
            fl = f.get('fieldName', fc)
            ft = f.get('dataType', 'TEXT')
            fr = 'true' if f.get('required') else 'false'
            opts = f.get('options', [])
            
            # Field definition for schema
            field_defs.append(f"    {{
      name: '{fc}',
      label: '{fl}',
      type: '{ft}',
      required: {fr},
      options: {json.dumps(opts, ensure_ascii=False)}
    }}")
            
            # Create options array for SELECT/RADIO
            options_code = ""
            if opts:
                options_list = ', '.join([f"{{ value: '{o.get('value', o)}', label: '{o.get('label', o)}' }}" for o in opts])
                options_code = f"const {fc}Options = [{options_list}];"
            
            # Field component in JSX
            field_items.append(f"""
          <Grid item xs={{12}} md={{6}} key="{fc}">
            <Typography variant="caption" color="textSecondary">
              {fl}{fr === 'true' && <Typography component="span" color="error"> *</Typography>}
            </Typography>
            <FieldFactory
              type="{ft}"
              value={{formData.{fc}}}
              onChange={{(v) => handleFieldChange('{fc}', v)}}
              options={{{fc}Options}}
              error={{!!errors.{fc}}}
              helperText={{errors.{fc}}}
            />
          </Grid>""")
        
        # Section tabs (if multiple sections)
        has_tabs = len(sections) > 1
        section_tabs = '\n'.join([
            f'              <Tab key={i} label="{s.get("sectionName", f"Section {i+1}")}" />'
            for i, s in enumerate(sections[:5])
        ])
        
        # Build code using list for reliability
        lines = [
            f'''/**
 * Screen: {screen}
 * Contract: #{cid}
 * Route: {route}
 * Process: {process} | Actor: {actor}
 * Generated: {datetime.now().isoformat()}
 * Fields: {len(fields)} | Sections: {len(sections)} | APIs: {len(apis)}
 */''',
            '',
            'import React, { useState, useEffect, useCallback } from "react";',
            'import { Card, CardHeader, CardContent, TextField, Button, Grid, Box, Typography, Alert, CircularProgress, Tabs, Tab, Paper, Divider } from "@mui/material";',
            'import { Save, Cancel, Refresh } from "@mui/icons-material";',
            'import { useNavigate } from "react-router-dom";',
            'import { api, useApi, useScreenState, useFormState } from "../../runtime";',
            'import { FieldFactory, CardSection, StatusChip } from "../../runtime";',
            '',
            *api_lines,
            '',
            f'export const {comp_name}Screen = () => {{',
            '  const navigate = useNavigate();',
            '  const { state, setLoading, setReady, setSaving, setError } = useScreenState("LOADING");',
            '  const { values: formData, handleChange: handleFieldChange, errors, setErrors, resetForm } = useFormState({{}});',
            '  const { loading, error: apiError, request } = useApi();',
            '',
            '  const [activeTab, setActiveTab] = useState(0);',
            '  const [tableData, setTableData] = useState<any[]>([]);',
            '  const [selectedRow, setSelectedRow] = useState<any>(null);',
            '',
            '  useEffect(() => {',
            '    setReady();',
            '    loadData();',
            '  }, []);',
            '',
            '  const loadData = useCallback(async () => {',
            '    setLoading();',
            '    const result = await request(() => api.get("/sample"));',
            '    if (result) {',
            '      setTableData(result.data || []);',
            '      setReady();',
            '    } else {',
            '      setError(apiError || "Failed to load");',
            '    }',
            '  }, []);',
            '',
            '  const handleSubmit = async () => {',
            '    setSaving();',
            '    const result = await request(() => api.post("/sample", formData));',
            '    if (result) {',
            '      setReady();',
            '      navigate(-1);',
            '    }',
            '  };',
            '',
            '  const handleReset = () => {',
            '    resetForm();',
            '  };',
            '',
            '  const handleRowClick = (row: any) => {',
            '    setSelectedRow(row);',
            '    // Navigate to detail or open dialog',
            '  };',
            '',
            '  return (',
            '    <Box sx={{ p: 3 }}>',
            '      {/* Header */}',
            '      <Box display="flex" justifyContent="space-between" alignItems="center" mb={{3}}>',
            f'        <Typography variant="h5">{screen}</Typography>',
            '        <Box display="flex" gap={{1}} alignItems="center">',
            '          <StatusChip status={{state}} />',
            '          <Button startIcon=<Refresh /> onClick={{loadData}} size="small">Refresh</Button>',
            '        </Box>',
            '      </Box>',
            '',
            '      {/* Loading */}',
            '      {state === "LOADING" && (',
            '        <Box display="flex" justifyContent="center" py={{5}}><CircularProgress /></Box>',
            '      )}',
            '',
            '      {/* Error */}',
            '      {(state === "ERROR" || apiError) && (',
            '        <Alert severity="error" onClose={{() => setReady()}}>{{apiError || "An error occurred"}}</Alert>',
            '      )}',
            '',
            '      {/* Content */}',
            '      {state !== "LOADING" && (',
            '        <Box>',
            '',
            '          {/* Section Tabs */}',
            has_tabs and f'''          <Paper sx={{ mb: 2 }}>
            <Tabs value={{activeTab}} onChange={{(_, v) => setActiveTab(v)}}>
{section_tabs}
            </Tabs>
          </Paper>''' or '          <Box sx={{ mb: 2 }} />',
            '',
            '          <CardSection title="{screen}" collapsible actions={{',
            '            <Button size="small" onClick={{handleReset}}>Reset</Button>',
            '          }}>',
            '            <Grid container spacing={{2}}>',
            *field_items,
            '            </Grid>',
            '          </CardSection>',
            '',
            '          {/* Action Bar */}',
            '          <Paper sx={{ p: 2, mt: 2 }}>',
            '            <Box display="flex" gap={{1}} justifyContent="flex-end">',
            '              <Button variant="outlined" onClick={{() => navigate(-1)}}>Cancel</Button>',
            '              <Button variant="outlined" onClick={{handleReset}}>Reset</Button>',
            '              <Button variant="contained" startIcon=<Save /> onClick={{handleSubmit}} disabled={{loading || state === "SAVING"}}>',
            '                Save',
            '              </Button>',
            '            </Box>',
            '          </Paper>',
            '',
            '        </Box>',
            '      )}',
            '    </Box>',
            '  );',
            '};',
            '',
            f'export default {comp_name}Screen;',
        ]
        
        return '\n'.join(lines)
    
    def get_summary(self) -> Dict:
        """Get generation summary"""
        return {
            'total_generated': len(self.generated),
            'total_errors': len(self.errors),
            'errors': self.errors[:10]  # First 10 errors
        }
