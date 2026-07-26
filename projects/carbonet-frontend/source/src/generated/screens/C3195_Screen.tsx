import React, { useState, useEffect, useCallback } from 'react';
import { Box, Container, Typography, Button, Paper, Alert, CircularProgress } from '@mui/material';
import { FieldFactory } from '../templates/FieldFactory';
import { CardSection, StatusChip } from '../templates/SectionComponents';
import { useScreenState, useFormState, useApi } from '../templates/hooks';
import { api, handleApiError } from '../templates/api_client';

// Screen: 한계감축비용 포트폴리오 업무 실행 중간 결과 저장 관리자 업무 화면
// Route: /admin/generated/macc-portfolio/macc-portfolio-s2
// Contract ID: 3195

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
  {name: 'baselineyear', label: '기준연도', type: 'TEXT', required: true},
  {name: 'baselineemission', label: '기준 배출량', type: 'TEXT', required: true},
  {name: 'targetyear', label: '목표연도', type: 'TEXT', required: true},
  {name: 'targetreduction', label: '목표 감축량', type: 'TEXT', required: true},
  {name: 'reductionmethod', label: '감축 수단', type: 'CODE', required: true},
  {name: 'expectedreduction', label: '예상 감축량', type: 'TEXT', required: true},
  {name: 'actualreduction', label: '실적 감축량', type: 'TEXT', required: false},
  {name: 'capex', label: '투자비', type: 'TEXT', required: false},
  {name: 'opex', label: '운영비', type: 'TEXT', required: false},
  {name: 'taskcomment', label: '업무 메모', type: 'TEXT', required: false},
  {name: 'dueat', label: '마감 일시', type: 'DATETIME', required: false},
  {name: 'nextactorcode', label: '다음 담당 액터', type: 'CODE', required: false},
];

const Screen3195: React.FC = () => {
  // Screen component
  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5">한계감축비용 포트폴리오 업무 실행 중간 결과 저장 관리자 업무 화면</Typography>
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

export default Screen3195;