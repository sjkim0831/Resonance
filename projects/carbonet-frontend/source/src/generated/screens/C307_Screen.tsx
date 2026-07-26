import React, { useState, useEffect, useCallback } from 'react';
import { Box, Container, Typography, Button, Paper, Alert, CircularProgress } from '@mui/material';
import { FieldFactory } from '../templates/FieldFactory';
import { CardSection, StatusChip } from '../templates/SectionComponents';
import { useScreenState, useFormState, useApi } from '../templates/hooks';
import { api, handleApiError } from '../templates/api_client';

// Screen: 책임 허가 정비기준 연결 관리자 업무 화면
// Route: /admin/ccus/facility/facility-asset-registry?step=far_assign
// Contract ID: 307

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
  {name: 'projectid', label: '프로젝트', type: 'TEXT', required: true},
  {name: 'facilityid', label: '설비 ID', type: 'TEXT', required: true},
  {name: 'assettag', label: '설비 태그', type: 'TEXT', required: true},
  {name: 'sitecode', label: '사업장·저장소', type: 'CODE', required: true},
  {name: 'statuscode', label: '업무 상태', type: 'CODE', required: true},
  {name: 'effectiveat', label: '발생·적용 일시', type: 'DATETIME', required: true},
  {name: 'measurementvalue', label: '측정·운영 값', type: 'TEXT', required: true},
  {name: 'unitcode', label: '단위', type: 'CODE', required: true},
  {name: 'risklevel', label: '위험 등급', type: 'CODE', required: true},
  {name: 'evidenceids', label: '원본 증빙', type: 'TEXT', required: true},
  {name: 'approvalcomment', label: '검토·승인 의견', type: 'TEXT', required: false},
  {name: 'rowversion', label: '데이터 버전', type: 'TEXT', required: true},
];

const Screen307: React.FC = () => {
  // Screen component
  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5">책임 허가 정비기준 연결 관리자 업무 화면</Typography>
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
              required={field.required}
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

export default Screen307;