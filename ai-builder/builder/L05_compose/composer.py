"""Compose React screen components from contracts"""

import json
from pathlib import Path
from typing import List, Dict, Any, Tuple

from builder.common.types import ScreenContract, FIELD_TYPES
from builder.common.base import LayerBase, LayerResult

class ScreenComposer(LayerBase):
    """Layer 05: Compose React components from contracts"""
    
    def __init__(self, templates: Dict[str, str] = None):
        super().__init__(5, "Screen Composer", "Compose React components from contracts")
        self.templates = templates or {}
    
    def execute(self, context: Dict, input_data: List[ScreenContract]) -> Tuple[bool, Dict[int, str], LayerResult]:
        """Compose screen components"""
        self.log("Starting screen composition")
        
        composed = {}
        errors = []
        
        for contract in input_data:
            try:
                component = self._compose_screen(contract)
                if component:
                    composed[contract.contract_id] = component
            except Exception as e:
                errors.append({'contract_id': contract.contract_id, 'error': str(e)})
                self.log_error(contract.contract_id, str(e))
        
        # Save composed screens
        output_path = Path("/tmp/builder_output/05_compose/composed_screens.json")
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        summary = {
            'total': len(input_data),
            'composed': len(composed),
            'failed': len(errors)
        }
        
        with open(output_path, 'w') as f:
            json.dump(summary, f, ensure_ascii=False, indent=2)
        
        result = self.create_result(
            len(errors) == 0, 0.1,
            processed_count=len(composed),
            failed_count=len(errors),
            artifacts={'output': str(output_path)}
        )
        
        self.log("Composed " + str(len(composed)) + " screens, " + str(len(errors)) + " failures")
        return len(errors) == 0, composed, result
    
    def _compose_screen(self, contract: ScreenContract) -> str:
        """Compose a single screen component"""
        
        # Generate imports
        imports = self._generate_imports(contract)
        
        # Generate state
        state = self._generate_state(contract)
        
        # Generate form fields
        form_fields = self._generate_form_fields(contract)
        
        # Generate render
        render = self._generate_render(contract)
        
        # Combine
        screen = imports + "\n" + state + "\n" + form_fields + "\n" + render
        
        return screen
    
    def _generate_imports(self, contract: ScreenContract) -> str:
        """Generate import statements"""
        lines = [
            "import React, { useState, useEffect, useCallback } from 'react';",
            "import { Box, Container, Typography, Button, Paper, Alert, CircularProgress } from '@mui/material';",
            "import { FieldFactory } from '../templates/FieldFactory';",
            "import { CardSection, StatusChip } from '../templates/SectionComponents';",
            "import { useScreenState, useFormState, useApi } from '../templates/hooks';",
            "import { api, handleApiError } from '../templates/api_client';",
            "",
            "// Screen: " + contract.screen_name,
            "// Route: " + contract.route_path,
            "// Contract ID: " + str(contract.contract_id),
            "",
        ]
        return "\n".join(lines)
    
    def _generate_state(self, contract: ScreenContract) -> str:
        """Generate state management"""
        lines = [
            "const { state, setLoading, setReady, setSaving, setError, setSubmitted } = useScreenState('READY');",
            "const { values, handleChange, errors, touched, dirty, resetForm, validateAll } = useFormState({});",
            "const { loading, error, request } = useApi();",
            "",
            "// Initialize form values from contract",
            "useEffect(() => {",
            "  const initial = {};",
        ]
        
        # Add field initial values
        for field in contract.field_contract:
            if field.default_value is not None:
                val = field.default_value
                if isinstance(val, str):
                    lines.append("  initial['" + field.field_code + "'] = '" + val + "';")
                else:
                    lines.append("  initial['" + field.field_code + "'] = " + str(val) + ";")
        
        lines.extend([
            "  resetForm(initial);",
            "}, []);",
            "",
        ])
        
        return "\n".join(lines)
    
    def _generate_form_fields(self, contract: ScreenContract) -> str:
        """Generate form field definitions"""
        lines = [
            "// Field definitions from contract",
            "const fieldDefinitions = [",
        ]
        
        for field in contract.field_contract:
            field_def = '  {'
            field_def += "name: '" + field.field_code + "', "
            field_def += "label: '" + field.field_name + "', "
            field_def += "type: '" + field.data_type + "', "
            field_def += "required: " + ('true' if field.required else 'false')
            
            if field.options:
                opts_json = json.dumps(field.options, ensure_ascii=False)
                field_def += ", options: " + opts_json
            
            if field.placeholder:
                field_def += ", placeholder: '" + field.placeholder + "'"
            
            field_def += '},'
            lines.append(field_def)
        
        lines.append("];")
        
        return "\n".join(lines)
    
    def _generate_render(self, contract: ScreenContract) -> str:
        """Generate render method - using list join to avoid f-string issues"""
        lines = [
            "",
            "const Screen" + str(contract.contract_id) + ": React.FC = () => {",
            "  // Screen component",
            "  return (",
            "    <Container maxWidth=\"lg\" sx={{ py: 3 }}>",
            "      <Box display=\"flex\" justifyContent=\"space-between\" alignItems=\"center\" mb={3}>",
            "        <Typography variant=\"h5\">" + contract.screen_name + "</Typography>",
            "        <StatusChip status={state} />",
            "      </Box>",
            "",
            "      {state === 'LOADING' && <CircularProgress />}",
            "      {error && <Alert severity=\"error\">{error}</Alert>}",
            "",
            "      <Paper sx={{ p: 3 }}>",
            "        <Box display=\"flex\" flexDirection=\"column\" gap={2}>",
            "          {fieldDefinitions.map((field) => (",
            "          <Box key={field.name}>",
            "            <Typography variant=\"caption\">{field.label}</Typography>",
            "            <FieldFactory",
            "              type={field.type}",
            "              value={values[field.name]||''}",
            "              onChange={(v) => handleChange(field.name, v)}",
            "              error={!!errors[field.name]}",
            "              helperText={errors[field.name]}",
        ]

        # Add required prop if any field is required
        has_required = any(f.required for f in contract.field_contract if f.visible)
        if has_required:
            lines.append("              required={field.required}")
        
        lines.extend([
            "            />",
            "          </Box>",
            "          ))}",
            "        </Box>",
            "      </Paper>",
            "",
            "      <Box display=\"flex\" gap={1} justifyContent=\"flex-end\" mt={3}>",
            "        <Button onClick={() => resetForm()}>Cancel</Button>",
            "        <Button variant=\"contained\" disabled={dirty}>Save</Button>",
            "      </Box>",
            "    </Container>",
            "  );",
            "};",
            "",
            "export default Screen" + str(contract.contract_id) + ";",
        ])
        
        return "\n".join(lines)
