import React, { useState, useEffect, useCallback } from 'react';
import { Box, Container, Typography, Button, Paper, Alert, CircularProgress } from '@mui/material';
import { FieldFactory } from '../templates/FieldFactory';
import { CardSection, StatusChip } from '../templates/SectionComponents';
import { useScreenState, useFormState, useApi } from '../templates/hooks';
import { api, handleApiError } from '../templates/api_client';

// Screen: 검토 승인 확정 사용자 업무 화면
// Route: /emission/validate?tab=approval
// Contract ID: 3

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
  {name: 'projectid', label: '프로젝트 ID', type: 'TEXT', required: true},
  {name: 'projectname', label: '프로젝트명', type: 'TEXT', required: true},
  {name: 'sitename', label: '사업장명', type: 'TEXT', required: true},
  {name: 'submissionid', label: '제출본 ID', type: 'TEXT', required: true},
  {name: 'submissionversion', label: '제출 버전', type: 'TEXT', required: true},
  {name: 'submissionstate', label: '제출 상태', type: 'CODE', required: true},
  {name: 'submittedactor', label: '제출자', type: 'TEXT', required: true},
  {name: 'submittedat', label: '제출 일시', type: 'DATETIME', required: true},
  {name: 'decision', label: '결정', type: 'CODE', required: true},
  {name: 'reviewcomment', label: '검토 의견', type: 'TEXT', required: false},
  {name: 'issuecount', label: '오류 건수', type: 'TEXT', required: true},
  {name: 'reviewid', label: '검토 이력 ID', type: 'TEXT', required: true},
  {name: 'reviewstage', label: '검토 단계', type: 'CODE', required: true},
  {name: 'reviewerid', label: '검토자', type: 'TEXT', required: true},
  {name: 'reviewcreatedat', label: '결정 일시', type: 'DATETIME', required: true},
  {name: 'reviewcalculationid', label: '산정 버전 ID', type: 'TEXT', required: false},
  {name: 'actorcode', label: '배정 액터', type: 'CODE', required: true},
  {name: 'actoruserid', label: '배정 사용자', type: 'TEXT', required: true},
  {name: 'actoractiveyn', label: '액터 활성 여부', type: 'TEXT', required: true},
  {name: 'calculationid', label: '산정 실행 ID', type: 'TEXT', required: true},
  {name: 'calculationversion', label: '산정 버전', type: 'TEXT', required: true},
  {name: 'totalemission', label: '총 배출량', type: 'TEXT', required: true},
  {name: 'snapshothash', label: '입력 지문', type: 'TEXT', required: true},
  {name: 'lockedat', label: '잠금 일시', type: 'DATETIME', required: false},
  {name: 'lockedby', label: '잠금 수행자', type: 'TEXT', required: false},
  {name: 'eventtype', label: '상태 이벤트', type: 'CODE', required: true},
  {name: 'previousstate', label: '이전 상태', type: 'CODE', required: true},
  {name: 'newstate', label: '변경 상태', type: 'CODE', required: true},
  {name: 'eventactor', label: '상태 변경자', type: 'TEXT', required: true},
  {name: 'eventnote', label: '상태 변경 사유', type: 'TEXT', required: false},
];

const Screen3: React.FC = () => {
  // Screen component
  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5">검토 승인 확정 사용자 업무 화면</Typography>
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

export default Screen3;