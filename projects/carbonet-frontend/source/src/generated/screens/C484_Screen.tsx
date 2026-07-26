import React, { useState, useEffect, useCallback } from 'react';
import { Box, Container, Typography, Button, Paper, Alert, CircularProgress } from '@mui/material';
import { FieldFactory } from '../templates/FieldFactory';
import { CardSection, StatusChip } from '../templates/SectionComponents';
import { useScreenState, useFormState, useApi } from '../templates/hooks';
import { api, handleApiError } from '../templates/api_client';

// Screen: 지표 주기 기준시점 확정 사용자 업무 화면
// Route: /work/scheduled-statistics-reporting?step=ssr_define
// Contract ID: 484

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
  {name: 'businessid', label: '업무 대상 ID', type: 'TEXT', required: true},
  {name: 'referencecode', label: '참조·로트·신청 번호', type: 'TEXT', required: true},
  {name: 'statuscode', label: '업무 상태', type: 'CODE', required: true},
  {name: 'effectiveat', label: '발생·적용 일시', type: 'DATETIME', required: true},
  {name: 'quantityvalue', label: '수량·측정·금액 값', type: 'TEXT', required: false},
  {name: 'unitcode', label: '단위·통화', type: 'CODE', required: false},
  {name: 'qualitycode', label: '품질·적합 등급', type: 'CODE', required: false},
  {name: 'externalcheckstatus', label: '외부검증 상태', type: 'CODE', required: false},
  {name: 'evidenceids', label: '원본·결정 증빙', type: 'TEXT', required: true},
  {name: 'decisioncode', label: '판정·승인 결과', type: 'CODE', required: false},
  {name: 'decisioncomment', label: '판정·보완·반려 사유', type: 'TEXT', required: false},
  {name: 'rowversion', label: '데이터 버전', type: 'TEXT', required: true},
  {name: 'nexttaskid', label: '다음 업무', type: 'TEXT', required: false},
];

const Screen484: React.FC = () => {
  // Screen component
  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5">지표 주기 기준시점 확정 사용자 업무 화면</Typography>
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

export default Screen484;