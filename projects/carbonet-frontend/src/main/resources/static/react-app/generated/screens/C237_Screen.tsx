import React, { useState, useEffect, useCallback } from 'react';
import { Box, Container, Typography, Button, Paper, Alert, CircularProgress } from '@mui/material';
import { FieldFactory } from '../templates/FieldFactory';
import { CardSection, StatusChip } from '../templates/SectionComponents';
import { useScreenState, useFormState, useApi } from '../templates/hooks';
import { api, handleApiError } from '../templates/api_client';

// Screen: 검토 승인
// Route: /admin/emission/approval-workflow
// Contract ID: 237

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
  {name: 'tenantid', label: '테넌트', type: 'TEXT', required: true},
  {name: 'projectid', label: '프로젝트', type: 'TEXT', required: true},
  {name: 'processcode', label: '프로세스 코드', type: 'CODE', required: true},
  {name: 'stepcode', label: '단계 코드', type: 'CODE', required: true},
  {name: 'recordid', label: '업무 레코드 ID', type: 'TEXT', required: false},
  {name: 'statuscode', label: '처리 상태', type: 'CODE', required: true},
  {name: 'owneractorcode', label: '담당 액터', type: 'CODE', required: true},
  {name: 'rowversion', label: '데이터 버전', type: 'TEXT', required: true},
  {name: 'createdat', label: '등록 일시', type: 'DATETIME', required: false},
  {name: 'updatedat', label: '최종 수정 일시', type: 'DATETIME', required: false},
  {name: 'evidencecount', label: '증빙 수', type: 'TEXT', required: false},
  {name: 'decisioncode', label: '판정', type: 'CODE', required: true},
  {name: 'reviewcomment', label: '검토 의견', type: 'TEXT', required: true},
  {name: 'rejectionreasoncode', label: '반려 사유', type: 'CODE', required: false},
  {name: 'decidedat', label: '판정 일시', type: 'DATETIME', required: false},
  {name: 'contract_802ef8ecf558', label: '확정 후보 버전', type: 'TEXT', required: true},
  {name: 'contract_52fb4aed3b91', label: '총 배출량', type: 'TEXT', required: true},
  {name: 'contract_7f305b60cda4', label: 'Scope별 결과', type: 'TEXT', required: true},
  {name: 'contract_4f7e4ca895b4', label: '검증 결과', type: 'TEXT', required: true},
  {name: 'contract_ffc1c1e325d7', label: '검토 의견', type: 'TEXT', required: true},
  {name: 'contract_858acd3eed85', label: '승인자', type: 'TEXT', required: true},
  {name: 'contract_f01f8f98d57a', label: '결정일시', type: 'TEXT', required: true},
  {name: 'contract_f40f87e6a33d', label: '반려사유', type: 'TEXT', required: true},
];

const Screen237: React.FC = () => {
  // Screen component
  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5">검토 승인</Typography>
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

export default Screen237;