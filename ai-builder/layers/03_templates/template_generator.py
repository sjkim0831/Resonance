"""Generate base component templates"""

from pathlib import Path
from typing import Dict, List, Any
import re

# MUI import map for field types
FIELD_TYPE_MAP = {
    'TEXT': 'TextField',
    'NUMBER': 'TextField',
    'EMAIL': 'TextField',
    'PASSWORD': 'TextField',
    'PHONE': 'TextField',
    'TEXTAREA': 'TextField',
    'DATE': 'DatePicker',
    'DATETIME': 'DateTimePicker',
    'SELECT': 'Select',
    'CHECKBOX': 'Checkbox',
    'SWITCH': 'Switch',
    'RADIO': 'RadioGroup',
    'AUTOCOMPLETE': 'Autocomplete',
    'SLIDER': 'Slider',
    'FILE': 'Button',  # File upload
    'IMAGE': 'Button',  # Image upload
    'CODE': 'Select',
    'ENUM': 'Select',
    'ADDRESS': 'TextField',
}

class TemplateGenerator:
    """Generate base React component templates"""
    
    def __init__(self, output_dir: Path):
        self.output_dir = output_dir
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.generated_files: List[Path] = []
    
    def generate_all(self) -> List[Path]:
        """Generate all base templates"""
        files = []
        files.append(self._generate_types())
        files.append(self._generate_hooks())
        files.append(self._generate_utils())
        files.append(self._generate_field_factory())
        files.append(self._generate_form_components())
        files.append(self._generate_section_components())
        files.append(self._generate_api_client())
        files.append(self._generate_registry())
        return [f for f in files if f]
    
    def _generate_types(self) -> Path:
        """Generate TypeScript type definitions"""
        code = '''// Auto-generated Type Definitions
// Generated: ''' + datetime.now().isoformat() + '''

export interface Contract {
  contract_id: number;
  route_path: string;
  screen_name: string;
  process_code: string;
  actor_code: string;
  api_contract: ApiDefinition[];
  state_contract: string[];
  fields: FieldDefinition[];
  sections: SectionDefinition[];
}

export interface ApiDefinition {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  code: string;
}

export interface FieldDefinition {
  fieldCode: string;
  fieldName: string;
  dataType: FieldType;
  required: boolean;
  options?: Option[];
  defaultValue?: any;
  placeholder?: string;
  helpText?: string;
  readOnly?: boolean;
  visible?: boolean;
  sectionCode?: string;
  validation?: ValidationRule[];
}

export interface SectionDefinition {
  sectionCode: string;
  sectionName: string;
  order: number;
  fields?: FieldDefinition[];
}

export interface Option {
  value: string | number;
  label: string;
}

export interface ValidationRule {
  type: string;
  value?: any;
  message?: string;
}

export type FieldType = 
  | 'TEXT' | 'NUMBER' | 'DATE' | 'DATETIME' | 'SELECT' | 'CHECKBOX' | 'SWITCH'
  | 'RADIO' | 'AUTOCOMPLETE' | 'SLIDER' | 'FILE' | 'IMAGE' | 'EMAIL' 
  | 'PASSWORD' | 'PHONE' | 'TEXTAREA' | 'CODE' | 'ENUM' | 'HIDDEN' 
  | 'CALCULATED' | 'ADDRESS';

export type ScreenState = 'LOADING' | 'READY' | 'SAVING' | 'ERROR' | 'EMPTY' | 'SUBMITTED';

export interface FormData {
  [key: string]: any;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: Record<string, string>;
}
'''
        path = self.output_dir / "types.ts"
        with open(path, 'w', encoding='utf-8') as f:
            f.write(code)
        return path
    
    def _generate_hooks(self) -> Path:
        """Generate React hooks"""
        code = '''// Auto-generated React Hooks
// Generated: ''' + datetime.now().isoformat() + '''

import { useState, useCallback, useEffect, useMemo } from 'react';

// ============================================================================
// useScreenState - Screen state management
// ============================================================================

export type ScreenState = 'LOADING' | 'READY' | 'SAVING' | 'ERROR' | 'EMPTY' | 'SUBMITTED';

interface UseScreenStateReturn {
  state: ScreenState;
  error: string | null;
  setLoading: () => void;
  setReady: () => void;
  setSaving: () => void;
  setError: (error: string) => void;
  setEmpty: () => void;
  setSubmitted: () => void;
}

export const useScreenState = (initialState: ScreenState = 'READY'): UseScreenStateReturn => {
  const [state, setState] = useState<ScreenState>(initialState);
  const [error, setErrorState] = useState<string | null>(null);

  const setLoading = useCallback(() => { setState('LOADING'); setErrorState(null); }, []);
  const setReady = useCallback(() => { setState('READY'); setErrorState(null); }, []);
  const setSaving = useCallback(() => { setState('SAVING'); }, []);
  const setError = useCallback((err: string) => { setState('ERROR'); setErrorState(err); }, []);
  const setEmpty = useCallback(() => { setState('EMPTY'); }, []);
  const setSubmitted = useCallback(() => { setState('SUBMITTED'); }, []);

  return { state, error, setLoading, setReady, setSaving, setError, setEmpty, setSubmitted };
};

// ============================================================================
// useFormState - Form state with validation
// ============================================================================

interface UseFormStateReturn {
  values: Record<string, any>;
  errors: Record<string, string>;
  touched: Record<string, boolean>;
  dirty: boolean;
  handleChange: (field: string, value: any) => void;
  handleBlur: (field: string) => void;
  setFieldError: (field: string, error: string) => void;
  resetForm: (initialValues?: Record<string, any>) => void;
  validateField: (field: string, validators: ValidatorFn[]) => string | null;
  validateAll: (rules: ValidationRules) => boolean;
  setValues: (values: Record<string, any>) => void;
}

type ValidatorFn = (value: any) => string | null;
type ValidationRules = Record<string, ValidatorFn[]>;

export const useFormState = (initialValues: Record<string, any> = {}): UseFormStateReturn => {
  const [values, setValuesState] = useState<Record<string, any>>(initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [dirty, setDirty] = useState(false);

  const handleChange = useCallback((field: string, value: any) => {
    setValuesState(prev => ({ ...prev, [field]: value }));
    setDirty(true);
  }, []);

  const handleBlur = useCallback((field: string) => {
    setTouched(prev => ({ ...prev, [field]: true }));
  }, []);

  const setFieldError = useCallback((field: string, error: string) => {
    setErrors(prev => ({ ...prev, [field]: error }));
  }, []);

  const resetForm = useCallback((newValues?: Record<string, any>) => {
    setValuesState(newValues || initialValues);
    setErrors({});
    setTouched({});
    setDirty(false);
  }, [initialValues]);

  const validateField = useCallback((field: string, validators: ValidatorFn[]): string | null => {
    for (const validator of validators) {
      const error = validator(values[field]);
      if (error) {
        setErrors(prev => ({ ...prev, [field]: error }));
        return error;
      }
    }
    setErrors(prev => { const n = {...prev}; delete n[field]; return n; });
    return null;
  }, [values]);

  const validateAll = useCallback((rules: ValidationRules): boolean => {
    const newErrors: Record<string, string> = {};
    let valid = true;
    for (const [field, validators] of Object.entries(rules)) {
      for (const validator of validators) {
        const error = validator(values[field]);
        if (error) {
          newErrors[field] = error;
          valid = false;
          break;
        }
      }
    }
    setErrors(newErrors);
    return valid;
  }, [values]);

  const setValues = useCallback((newValues: Record<string, any>) => {
    setValuesState(newValues);
  }, []);

  return { values, errors, touched, dirty, handleChange, handleBlur, setFieldError, resetForm, validateField, validateAll, setValues };
};

// ============================================================================
// useApi - API request with loading/error state
// ============================================================================

interface UseApiReturn {
  loading: boolean;
  error: string | null;
  request: <T>(fn: () => Promise<T>) => Promise<T | null>;
  reset: () => void;
}

export const useApi = (): UseApiReturn => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const request = useCallback(async <T>(fn: () => Promise<T>): Promise<T | null> => {
    setLoading(true);
    setError(null);
    try {
      const result = await fn();
      return result;
    } catch (err: any) {
      setError(err.message || 'An error occurred');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setLoading(false);
    setError(null);
  }, []);

  return { loading, error, request, reset };
};

// ============================================================================
// useDebounce - Debounced value
// ============================================================================

export const useDebounce = <T>(value: T, delay: number = 300): T => {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
};

// ============================================================================
// useLocalStorage - Persistent state
// ============================================================================

export const useLocalStorage = <T>(key: string, initialValue: T): [T, (value: T) => void] => {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch { return initialValue; }
  });

  const setValue = (value: T) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (err) { console.error('LocalStorage error:', err); }
  };

  return [storedValue, setValue];
};
'''
        path = self.output_dir / "hooks.ts"
        with open(path, 'w', encoding='utf-8') as f:
            f.write(code)
        return path
    
    def _generate_utils(self) -> Path:
        """Generate utility functions"""
        code = '''// Auto-generated Utility Functions
// Generated: ''' + datetime.now().isoformat() + '''

// ============================================================================
// Validation Utilities
// ============================================================================

export type ValidatorFn = (value: any) => string | null;

export const required: ValidatorFn = (value) => {
  if (value === null || value === undefined || value === '') return 'Required';
  if (Array.isArray(value) && value.length === 0) return 'Required';
  return null;
};

export const minLength = (min: number): ValidatorFn => 
  (value) => value && value.length < min ? `Minimum ${min} characters` : null;

export const maxLength = (max: number): ValidatorFn => 
  (value) => value && value.length > max ? `Maximum ${max} characters` : null;

export const email: ValidatorFn = (value) => 
  value && !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(value) ? 'Invalid email' : null;

export const phone: ValidatorFn = (value) => 
  value && !/^\\d{3}-\\d{4}-\\d{4}$/.test(value) ? 'Format: 010-0000-0000' : null;

export const pattern = (regex: RegExp, message: string): ValidatorFn => 
  (value) => value && !regex.test(value) ? message : null;

export const min = (minVal: number): ValidatorFn => 
  (value) => value !== null && value !== undefined && Number(value) < minVal ? `Minimum: ${minVal}` : null;

export const max = (maxVal: number): ValidatorFn => 
  (value) => value !== null && value !== undefined && Number(value) > maxVal ? `Maximum: ${maxVal}` : null;

export const oneOf = (values: any[], message?: string): ValidatorFn =>
  (value) => value && !values.includes(value) ? (message || 'Invalid value') : null;

// ============================================================================
// Formatting Utilities
// ============================================================================

export const formatDate = (date: string | Date, format: string = 'yyyy-MM-dd'): string => {
  if (!date) return '';
  const d = new Date(date);
  return format
    .replace('yyyy', String(d.getFullYear()))
    .replace('MM', String(d.getMonth() + 1).padStart(2, '0'))
    .replace('dd', String(d.getDate()).padStart(2, '0'))
    .replace('HH', String(d.getHours()).padStart(2, '0'))
    .replace('mm', String(d.getMinutes()).padStart(2, '0'))
    .replace('ss', String(d.getSeconds()).padStart(2, '0'));
};

export const formatNumber = (num: number, decimals: number = 0): string => {
  if (num === null || num === undefined) return '';
  return Number(num).toLocaleString('ko-KR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
};

export const formatCurrency = (amount: number, currency: string = 'KRW'): string => {
  return new Intl.NumberFormat('ko-KR', { style: 'currency', currency }).format(amount);
};

// ============================================================================
// General Utilities
// ============================================================================

export const generateId = (): string => Math.random().toString(36).substr(2, 9);

export const debounce = <T extends (...args: any[]) => any>(
  func: T, wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

export const cloneDeep = <T>(obj: T): T => JSON.parse(JSON.stringify(obj));

export const isEmpty = (value: any): boolean => {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
};
'''
        path = self.output_dir / "utils.ts"
        with open(path, 'w', encoding='utf-8') as f:
            f.write(code)
        return path
    
    def _generate_field_factory(self) -> Path:
        """Generate FieldFactory component"""
        code = '''// Auto-generated FieldFactory Component
// Generated: ''' + datetime.now().isoformat() + '''

import React, { useState } from 'react';
import { TextField, Select, MenuItem, FormControl, InputLabel, Checkbox, FormControlLabel, Switch, Radio, RadioGroup, FormLabel, Slider, Autocomplete, Box, IconButton, InputAdornment } from '@mui/material';
import { Visibility, VisibilityOff } from '@mui/icons-material';

// ============================================================================
// Field Factory - Renders field by type
// ============================================================================

interface FieldFactoryProps {
  type: string;
  value: any;
  onChange: (value: any) => void;
  label?: string;
  required?: boolean;
  error?: boolean;
  helperText?: string;
  options?: Array<{ value: any; label: string }>;
  disabled?: boolean;
  readOnly?: boolean;
  placeholder?: string;
  [key: string]: any;
}

export const FieldFactory: React.FC<FieldFactoryProps> = ({
  type,
  value,
  onChange,
  label,
  required,
  error,
  helperText,
  options = [],
  disabled = false,
  readOnly = false,
  ...props
}) => {
  const [showPassword, setShowPassword] = useState(false);
  
  const typeUpper = (type || 'TEXT').toUpperCase();
  
  const commonProps = {
    disabled: disabled || readOnly,
    error: error,
    helperText: error || helperText,
    fullWidth: true,
    size: 'small' as const,
  };

  switch (typeUpper) {
    // Text fields
    case 'TEXT':
    case 'EMAIL':
    case 'PHONE':
      return (
        <TextField
          {...commonProps}
          type={typeUpper === 'PHONE' ? 'tel' : typeUpper === 'EMAIL' ? 'email' : 'text'}
          label={label}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          inputProps={{ maxLength: typeUpper === 'PHONE' ? 13 : undefined }}
        />
      );

    case 'NUMBER':
    case 'CALCULATED':
      return (
        <TextField
          {...commonProps}
          type="number"
          label={label}
          value={value ?? ''}
          onChange={(e) => onChange(parseFloat(e.target.value) || null)}
          required={required}
          InputProps={{ readOnly: typeUpper === 'CALCULATED' }}
        />
      );

    case 'PASSWORD':
      return (
        <TextField
          {...commonProps}
          type={showPassword ? 'text' : 'password'}
          label={label}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          InputProps={{
            endAdornment: (
              <InputAdornment>
                <IconButton onClick={() => setShowPassword(!showPassword)} edge="end">
                  {showPassword ? <VisibilityOff /> : <Visibility />}
                </IconButton>
              </InputAdornment>
            ),
          }}
        />
      );

    case 'TEXTAREA':
      return (
        <TextField
          {...commonProps}
          multiline
          rows={4}
          label={label}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          placeholder={placeholder}
        />
      );

    // Date/Time
    case 'DATE':
      return (
        <TextField
          {...commonProps}
          type="date"
          label={label}
          value={value ? value.split('T')[0] : ''}
          onChange={(e) => onChange(e.target.value ? new Date(e.target.value).toISOString() : null)}
          required={required}
          InputLabelProps={{ shrink: true }}
        />
      );

    case 'DATETIME':
      return (
        <TextField
          {...commonProps}
          type="datetime-local"
          label={label}
          value={value ? value.slice(0, 16) : ''}
          onChange={(e) => onChange(e.target.value ? new Date(e.target.value).toISOString() : null)}
          required={required}
          InputLabelProps={{ shrink: true }}
        />
      );

    // Selection
    case 'SELECT':
    case 'CODE':
    case 'ENUM':
      return (
        <FormControl {...commonProps} required={required}>
          <InputLabel>{label}</InputLabel>
          <Select
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value)}
            label={label}
          >
            {options.map((opt) => (
              <MenuItem key={opt.value} value={opt.value}>
                <Box display="flex" justifyContent="space-between" width="100%">
                  <span>{opt.label}</span>
                  <Box component="span" color="text.secondary" fontSize="small">
                    {String(opt.value)}
                  </Box>
                </Box>
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      );

    case 'CHECKBOX':
      return (
        <FormControlLabel
          control={
            <Checkbox
              checked={!!value}
              onChange={(e) => onChange(e.target.checked)}
              disabled={disabled || readOnly}
            />
          }
          label={label}
        />
      );

    case 'SWITCH':
      return (
        <FormControlLabel
          control={
            <Switch
              checked={!!value}
              onChange={(e) => onChange(e.target.checked)}
              disabled={disabled || readOnly}
            />
          }
          label={label}
        />
      );

    case 'RADIO':
      return (
        <FormControl {...commonProps}>
          <FormLabel>{label}</FormLabel>
          <RadioGroup value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
            {options.map((opt) => (
              <FormControlLabel
                key={opt.value}
                value={opt.value}
                control={<Radio />}
                label={opt.label}
              />
            ))}
          </RadioGroup>
        </FormControl>
      );

    case 'AUTOCOMPLETE':
      return (
        <Autocomplete
          value={value ?? null}
          onChange={(_, newValue) => onChange(newValue)}
          options={options}
          getOptionLabel={(opt) => typeof opt === 'string' ? opt : opt.label || String(opt.value)}
          renderInput={(params) => (
            <TextField {...params} label={label} required={required} {...commonProps} />
          )}
          disabled={disabled || readOnly}
        />
      );

    case 'SLIDER':
      return (
        <Box sx={{ width: '100%', px: 1 }}>
          {label && <Box sx={{ mb: 1 }}>{label}</Box>}
          <Slider
            value={value ?? 0}
            onChange={(_, newValue) => onChange(newValue)}
            disabled={disabled || readOnly}
            {...props}
          />
        </Box>
      );

    case 'ADDRESS':
      return (
        <TextField
          {...commonProps}
          label={label}
          value={value?.base || value || ''}
          onChange={(e) => onChange({ ...value, base: e.target.value })}
          placeholder="Address"
          required={required}
        />
      );

    case 'HIDDEN':
      return <input type="hidden" value={value ?? ''} />;

    case 'FILE':
    case 'IMAGE':
      return (
        <Box>
          <input
            type="file"
            accept={typeUpper === 'IMAGE' ? 'image/*' : undefined}
            id={`file-${label}`}
            style={{ display: 'none' }}
            onChange={(e) => onChange(e.target.files?.[0] || null)}
            disabled={disabled || readOnly}
          />
          <label htmlFor={`file-${label}`}>
            <Box component="span" sx={{ 
              cursor: disabled ? 'not-allowed' : 'pointer',
              color: disabled ? 'text.disabled' : 'primary.main',
              textDecoration: 'underline'
            }}>
              {value ? (typeof value === 'string' ? value.split('/').pop() : value.name) : 'Select file'}
            </Box>
          </label>
        </Box>
      );

    default:
      return (
        <TextField
          {...commonProps}
          label={label}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          placeholder={placeholder}
        />
      );
  }
};

export default FieldFactory;
'''
        path = self.output_dir / "FieldFactory.tsx"
        with open(path, 'w', encoding='utf-8') as f:
            f.write(code)
        return path
    
    def _generate_form_components(self) -> Path:
        """Generate form components"""
        code = '''// Auto-generated Form Components
// Generated: ''' + datetime.now().isoformat() + '''

import React from 'react';
import { Box, Button, Grid, Typography, Card, CardContent, CardActions, IconButton, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper } from '@mui/material';
import { Add, Delete, Edit, MoveUp, MoveDown } from '@mui/icons-material';
import { FieldFactory } from './FieldFactory';
import { useFormState } from './hooks';

// ============================================================================
// AutoForm - Generate form from field definitions
// ============================================================================

interface FieldDef {
  name: string;
  label?: string;
  type?: string;
  required?: boolean;
  options?: Array<{ value: any; label: string }>;
  [key: string]: any;
}

interface AutoFormProps {
  fields: FieldDef[];
  values?: Record<string, any>;
  onSubmit: (data: Record<string, any>) => void;
  onChange?: (data: Record<string, any>) => void;
  readonly?: boolean;
  columns?: number;
}

export const AutoForm: React.FC<AutoFormProps> = ({
  fields,
  values = {},
  onSubmit,
  onChange,
  readonly = false,
  columns = 2
}) => {
  const { values: formValues, handleChange, errors } = useFormState(values);

  React.useEffect(() => {
    onChange?.(formValues);
  }, [formValues]);

  const handleSubmit = () => {
    onSubmit(formValues);
  };

  return (
    <Box>
      <Grid container spacing={2}>
        {fields.map((field) => (
          <Grid item xs={12} md={12 / columns} key={field.name}>
            <Typography variant="caption" color="textSecondary">
              {field.label}{field.required && <Typography component="span" color="error"> *</Typography>}
            </Typography>
            <FieldFactory
              type={field.type}
              value={formValues[field.name]}
              onChange={(v) => handleChange(field.name, v)}
              options={field.options}
              disabled={readonly}
              error={!!errors[field.name]}
              helperText={errors[field.name]}
            />
          </Grid>
        ))}
      </Grid>
      {!readonly && (
        <Box display="flex" gap={1} justifyContent="flex-end" mt={3}>
          <Button variant="contained" onClick={handleSubmit}>Save</Button>
        </Box>
      )}
    </Box>
  );
};

// ============================================================================
// FormArray - Dynamic array of items
// ============================================================================

interface FormArrayProps {
  label: string;
  template: FieldDef[];
  values?: any[];
  onChange?: (items: any[]) => void;
  readonly?: boolean;
  minItems?: number;
  maxItems?: number;
}

export const FormArray: React.FC<FormArrayProps> = ({
  label,
  template,
  values = [],
  onChange,
  readonly = false,
  minItems = 0,
  maxItems = 10
}) => {
  const [items, setItems] = React.useState(values);

  const handleAdd = () => {
    if (items.length < maxItems) {
      const newItem = {};
      template.forEach(f => { newItem[f.name] = ''; });
      const updated = [...items, newItem];
      setItems(updated);
      onChange?.(updated);
    }
  };

  const handleRemove = (index: number) => {
    if (items.length > minItems) {
      const updated = items.filter((_, i) => i !== index);
      setItems(updated);
      onChange?.(updated);
    }
  };

  const handleUpdate = (index: number, field: string, value: any) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    setItems(updated);
    onChange?.(updated);
  };

  return (
    <Card sx={{ mb: 2 }}>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="subtitle1">
            {label} ({items.length})
          </Typography>
          {!readonly && (
            <Button size="small" startIcon={<Add />} onClick={handleAdd} disabled={items.length >= maxItems}>
              Add
            </Button>
          )}
        </Box>

        {items.length === 0 ? (
          <Typography variant="body2" color="textSecondary">No items</Typography>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  {template.map(f => (
                    <TableCell key={f.name} sx={{ fontWeight: 'bold' }}>{f.label}</TableCell>
                  ))}
                  {!readonly && <TableCell width={60}>Actions</TableCell>}
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((item, i) => (
                  <TableRow key={i}>
                    {template.map(f => (
                      <TableCell key={f.name}>
                        <FieldFactory
                          type={f.type}
                          value={item[f.name]}
                          onChange={(v) => handleUpdate(i, f.name, v)}
                          options={f.options}
                          disabled={readonly}
                          size="small"
                        />
                      </TableCell>
                    ))}
                    {!readonly && (
                      <TableCell>
                        <IconButton 
                          size="small" 
                          onClick={() => handleRemove(i)}
                          disabled={items.length <= minItems}
                        >
                          <Delete fontSize="small" />
                        </IconButton>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </CardContent>
    </Card>
  );
};

export default { AutoForm, FormArray };
'''
        path = self.output_dir / "FormComponents.tsx"
        with open(path, 'w', encoding='utf-8') as f:
            f.write(code)
        return path
    
    def _generate_section_components(self) -> Path:
        """Generate section components"""
        code = '''// Auto-generated Section Components
// Generated: ''' + datetime.now().isoformat() + '''

import React, { useState } from 'react';
import { Card, CardHeader, CardContent, CardActions, Box, Typography, Button, Grid, Collapse, IconButton, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Chip } from '@mui/material';
import { ExpandMore, Add, Edit, Delete, Refresh } from '@mui/icons-material';

// ============================================================================
// CardSection - Collapsible card section
// ============================================================================

interface CardSectionProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  collapsible?: boolean;
  defaultExpanded?: boolean;
}

export const CardSection: React.FC<CardSectionProps> = ({
  title,
  subtitle,
  children,
  actions,
  collapsible = false,
  defaultExpanded = true
}) => {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <Card sx={{ mb: 2 }}>
      <CardHeader
        title={title}
        subheader={subtitle}
        action={
          <Box display="flex" alignItems="center" gap={1}>
            {actions}
            {collapsible && (
              <IconButton onClick={() => setExpanded(!expanded)} size="small">
                <ExpandMore sx={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: '0.2s' }} />
              </IconButton>
            )}
          </Box>
        }
      />
      <Collapse in={expanded}>
        <CardContent>{children}</CardContent>
      </Collapse>
    </Card>
  );
};

// ============================================================================
// TableSection - Table with data
// ============================================================================

interface Column {
  field: string;
  headerName: string;
  render?: (value: any, row?: any) => React.ReactNode;
  width?: number;
}

interface TableSectionProps {
  title: string;
  columns: Column[];
  data: any[];
  onRowClick?: (row: any) => void;
  onAdd?: () => void;
  onEdit?: (row: any) => void;
  onDelete?: (row: any) => void;
  emptyMessage?: string;
}

export const TableSection: React.FC<TableSectionProps> = ({
  title,
  columns,
  data = [],
  onRowClick,
  onAdd,
  onEdit,
  onDelete,
  emptyMessage = 'No data'
}) => {
  return (
    <Card sx={{ mb: 2 }}>
      <CardHeader
        title={title}
        action={onAdd && <Button startIcon={<Add />} onClick={onAdd} size="small">Add</Button>}
      />
      <CardContent>
        {data.length === 0 ? (
          <Typography variant="body2" color="textSecondary" align="center" py={3}>
            {emptyMessage}
          </Typography>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  {columns.map(col => (
                    <TableCell key={col.field} sx={{ fontWeight: 'bold', width: col.width }}>
                      {col.headerName}
                    </TableCell>
                  ))}
                  {(onEdit || onDelete) && <TableCell width={100}>Actions</TableCell>}
                </TableRow>
              </TableHead>
              <TableBody>
                {data.map((row, i) => (
                  <TableRow 
                    key={i} 
                    hover 
                    onClick={() => onRowClick?.(row)}
                    sx={{ cursor: onRowClick ? 'pointer' : 'default' }}
                  >
                    {columns.map(col => (
                      <TableCell key={col.field}>
                        {col.render ? col.render(row[col.field], row) : row[col.field]}
                      </TableCell>
                    ))}
                    {(onEdit || onDelete) && (
                      <TableCell>
                        {onEdit && (
                          <IconButton size="small" onClick={(e) => { e.stopPropagation(); onEdit(row); }}>
                            <Edit fontSize="small" />
                          </IconButton>
                        )}
                        {onDelete && (
                          <IconButton size="small" onClick={(e) => { e.stopPropagation(); onDelete(row); }}>
                            <Delete fontSize="small" color="error" />
                          </IconButton>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </CardContent>
    </Card>
  );
};

// ============================================================================
// StatusChip - Status indicator
// ============================================================================

export const StatusChip: React.FC<{ status: string }> = ({ status }) => {
  const statusConfig: Record<string, { color: 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info'; label: string }> = {
    READY: { color: 'success', label: 'Ready' },
    LOADING: { color: 'info', label: 'Loading' },
    SAVING: { color: 'warning', label: 'Saving' },
    ERROR: { color: 'error', label: 'Error' },
    EMPTY: { color: 'default', label: 'Empty' },
    SUBMITTED: { color: 'success', label: 'Submitted' },
    APPROVED: { color: 'success', label: 'Approved' },
    REJECTED: { color: 'error', label: 'Rejected' },
    PENDING: { color: 'warning', label: 'Pending' },
  };

  const config = statusConfig[status.toUpperCase()] || { color: 'default' as const, label: status };

  return <Chip label={config.label} color={config.color} size="small" />;
};

export default { CardSection, TableSection, StatusChip };
'''
        path = self.output_dir / "SectionComponents.tsx"
        with open(path, 'w', encoding='utf-8') as f:
            f.write(code)
        return path
    
    def _generate_api_client(self) -> Path:
        """Generate API client"""
        code = '''// Auto-generated API Client
// Generated: ''' + datetime.now().isoformat() + '''

import axios, { AxiosError } from 'axios';

// ============================================================================
// API Client Configuration
// ============================================================================

const apiClient = axios.create({
  baseURL: process.env.REACT_APP_API_BASE_URL || '/api',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    console.log(`[API] ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor
apiClient.interceptors.response.use(
  (response) => {
    console.log(`[API] ${response.status} ${response.config.url}`);
    return response;
  },
  async (error: AxiosError) => {
    if (error.response?.status === 401) {
      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken) {
        try {
          const res = await axios.post('/api/auth/refresh', { refreshToken });
          localStorage.setItem('accessToken', res.data.accessToken);
          error.config.headers.Authorization = `Bearer ${res.data.accessToken}`;
          return apiClient.request(error.config);
        } catch {
          localStorage.clear();
          window.location.href = '/login';
        }
      } else {
        window.location.href = '/login';
      }
    }
    console.error('[API Error]', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

// ============================================================================
// Generic API Methods
// ============================================================================

export const api = {
  get: <T = any>(url: string, params?: any, config?: any): Promise<T> =>
    apiClient.get(url, { params, ...config }).then(res => res.data),

  post: <T = any>(url: string, data?: any, config?: any): Promise<T> =>
    apiClient.post(url, data, config).then(res => res.data),

  put: <T = any>(url: string, data?: any, config?: any): Promise<T> =>
    apiClient.put(url, data, config).then(res => res.data),

  patch: <T = any>(url: string, data?: any, config?: any): Promise<T> =>
    apiClient.patch(url, data, config).then(res => res.data),

  delete: <T = any>(url: string, config?: any): Promise<T> =>
    apiClient.delete(url, config).then(res => res.data),
};

// ============================================================================
// Error Handler
// ============================================================================

export const handleApiError = (error: any): string => {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data;
    if (data?.message) return data.message;
    switch (error.response?.status) {
      case 400: return 'Invalid request';
      case 401: return 'Please login';
      case 403: return 'Access denied';
      case 404: return 'Not found';
      case 500: return 'Server error';
      default: return 'An error occurred';
    }
  }
  return 'Network error';
};

// ============================================================================
// Typed API Endpoints
// ============================================================================

export const endpoints = {
  auth: {
    login: (body: any) => api.post('/auth/login', body),
    logout: () => api.post('/auth/logout'),
    refresh: (body: any) => api.post('/auth/refresh', body),
    me: () => api.get('/auth/me'),
  },
  common: {
    codes: (codeGroup: string) => api.get(`/common/codes/${codeGroup}`),
    users: { list: (params?: any) => api.get('/users', { params }) },
    organizations: () => api.get('/organizations'),
  },
};

export default apiClient;
'''
        path = self.output_dir / "api_client.ts"
        with open(path, 'w', encoding='utf-8') as f:
            f.write(code)
        return path
    
    def _generate_registry(self) -> Path:
        """Generate screen registry"""
        code = '''// Auto-generated Screen Registry
// Generated: ''' + datetime.now().isoformat() + '''
// This file is auto-generated. DO NOT EDIT MANUALLY.

import React from 'react';

// Screen component type
export type ScreenComponent = React.FC<any>;

// Registry entry
export interface ScreenEntry {
  component: ScreenComponent;
  route: string;
  screenName: string;
  contractId: number;
  processCode: string;
}

// Screen registry - populated by generator
export const screenRegistry: Record<string, ScreenEntry> = {};

// Register screen
export const registerScreen = (
  key: string,
  component: ScreenComponent,
  route: string,
  screenName: string,
  contractId: number,
  processCode: string
) => {
  screenRegistry[key] = { component, route, screenName, contractId, processCode };
};

// Get screen by key
export const getScreen = (key: string): ScreenEntry | undefined => {
  return screenRegistry[key];
};

// Get all registered screens
export const getAllScreens = (): ScreenEntry[] => {
  return Object.values(screenRegistry);
};

// Generate route config for react-router
export const generateRouteConfig = () => {
  return Object.entries(screenRegistry).map(([key, entry]) => ({
    path: entry.route,
    element: React.createElement(entry.component),
    key: key,
  }));
};
'''
        path = self.output_dir / "screen_registry.ts"
        with open(path, 'w', encoding='utf-8') as f:
            f.write(code)
        return path

from datetime import datetime
