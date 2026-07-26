import React, { useState, useEffect, useCallback } from 'react';
import { Box, Container, Typography, Button, Paper, Alert, CircularProgress } from '@mui/material';
import { FieldFactory } from '../templates/FieldFactory';
import { CardSection, StatusChip } from '../templates/SectionComponents';
import { useScreenState, useFormState, useApi } from '../templates/hooks';
import { api, handleApiError } from '../templates/api_client';

// Screen: 감축 전략 시나리오
// Route: /emission/simulate
// Contract ID: 251

const { state, setLoading, setReady, setSaving, setError, setSubmitted } = useScreenState('READY');
const { values, handleChange, errors, touched, dirty, resetForm, validateAll } = useFormState({});
const { loading, error, request } = useApi();

// Initialize form values from contract
useEffect(() => {
  const initial = {};
  resetForm(initial);
}, []);

// Field definitions from contract
const fieldDefinitions = [
];

const Screen251: React.FC = () => {
  // Screen component
  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5">감축 전략 시나리오</Typography>
        <StatusChip status={state} />
      </Box>

      {state === 'LOADING' && <CircularProgress />}
      {error && <Alert severity="error">{error}</Alert>}

      <Paper sx={{ p: 3 }}>
        <Box display="flex" flexDirection="column" gap={2}>
          {fieldDefinitions.map((field) => (
          <Box key={field.name}>
            <Typography variant="caption">{field.label}</Typography>
            <FieldFactory
              type={field.type}
              value={values[field.name]||''}
              onChange={(v) => handleChange(field.name, v)}
              error={!!errors[field.name]}
              helperText={errors[field.name]}
            />
          </Box>
          ))}
        </Box>
      </Paper>

      <Box display="flex" gap={1} justifyContent="flex-end" mt={3}>
        <Button onClick={() => resetForm()}>Cancel</Button>
        <Button variant="contained" disabled={dirty}>Save</Button>
      </Box>
    </Container>
  );
};

export default Screen251;