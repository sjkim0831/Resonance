import React, { useState, useEffect, useCallback } from 'react';
import { Box, Container, Typography, Button, Paper, Alert, CircularProgress } from '@mui/material';
import { FieldFactory } from '../templates/FieldFactory';
import { CardSection, StatusChip } from '../templates/SectionComponents';
import { useScreenState, useFormState, useApi } from '../templates/hooks';
import { api, handleApiError } from '../templates/api_client';

// Screen: 보고서 작성 확정
// Route: /emission/report_submit
// Contract ID: 130

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
  {name: 'reportid', label: '보고서', type: 'TEXT', required: true},
  {name: 'certificateid', label: '인증서', type: 'TEXT', required: false},
  {name: 'reportversion', label: '보고서 버전', type: 'TEXT', required: true},
  {name: 'integrityhash', label: '무결성 해시', type: 'TEXT', required: true},
  {name: 'datasethash', label: '데이터셋 해시', type: 'TEXT', required: true},
  {name: 'certificatestatus', label: '인증 상태', type: 'CODE', required: true},
  {name: 'issuedat', label: '발급 일시', type: 'DATETIME', required: false},
  {name: 'documentversion', label: '문서 버전', type: 'TEXT', required: true},
  {name: 'languagecode', label: '문서 언어', type: 'CODE', required: true},
  {name: 'documenthash', label: '문서 해시', type: 'TEXT', required: false},
  {name: 'downloadformat', label: '다운로드 형식', type: 'CODE', required: false},
  {name: 'contract_023ff6ee260a', label: '보고서 버전', type: 'TEXT', required: true},
  {name: 'contract_681191ac7b10', label: '산정 버전', type: 'TEXT', required: true},
  {name: 'contract_23eb275e790b', label: '언어', type: 'TEXT', required: true},
  {name: 'contract_34e86dd7a4ba', label: '제출처', type: 'TEXT', required: true},
  {name: 'contract_52fb4aed3b91', label: '총 배출량', type: 'TEXT', required: true},
  {name: 'contract_704973d44519', label: 'Scope 결과', type: 'TEXT', required: true},
  {name: 'contract_1057b71501e1', label: '제품·부산물', type: 'TEXT', required: true},
  {name: 'contract_51aceccca925', label: '정규화 데이터셋', type: 'TEXT', required: true},
  {name: 'contract_f529c51ee65a', label: 'OCR', type: 'TEXT', required: true},
  {name: 'contract_5149310e180b', label: '시각지문', type: 'TEXT', required: true},
  {name: 'contract_91c27081e798', label: '발급상태', type: 'TEXT', required: true},
];

const Screen130: React.FC = () => {
  // Screen component
  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5">보고서 작성 확정</Typography>
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

export default Screen130;