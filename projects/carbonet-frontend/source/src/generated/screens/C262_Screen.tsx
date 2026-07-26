import React, { useState, useEffect, useCallback } from 'react';
import { Box, Container, Typography, Button, Paper, Alert, CircularProgress } from '@mui/material';
import { FieldFactory } from '../templates/FieldFactory';
import { CardSection, StatusChip } from '../templates/SectionComponents';
import { useScreenState, useFormState, useApi } from '../templates/hooks';
import { api, handleApiError } from '../templates/api_client';

// Screen: 제출 범위 기한 확인
// Route: /emission/report-submission
// Contract ID: 262

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
  {name: 'projectperiod', label: '산정 기간', type: 'TEXT', required: true},
  {name: 'reportid', label: '확정 보고서 ID', type: 'TEXT', required: true},
  {name: 'reportversion', label: '보고서 버전', type: 'TEXT', required: true},
  {name: 'reporttitle', label: '보고서 제목', type: 'TEXT', required: true},
  {name: 'reportstatus', label: '보고서 상태', type: 'CODE', required: true},
  {name: 'certificateid', label: '인증서 ID', type: 'TEXT', required: false},
  {name: 'integrityhash', label: '보고서 무결성 해시', type: 'TEXT', required: false},
  {name: 'finalizedat', label: '보고서 확정 일시', type: 'DATETIME', required: true},
  {name: 'submissionid', label: '제출 패키지 ID', type: 'TEXT', required: true},
  {name: 'submissionversion', label: '제출 버전', type: 'TEXT', required: true},
  {name: 'authoritycode', label: '기관 코드', type: 'TEXT', required: true},
  {name: 'authorityname', label: '기관명', type: 'TEXT', required: true},
  {name: 'reportingprogram', label: '제출 제도·사업', type: 'TEXT', required: true},
  {name: 'reportingperiod', label: '보고 기간', type: 'TEXT', required: true},
  {name: 'legalbasis', label: '법적 근거', type: 'TEXT', required: true},
  {name: 'channel', label: '제출 채널', type: 'CODE', required: true},
  {name: 'deadline', label: '제출 기한', type: 'DATE', required: true},
  {name: 'status', label: '제출 상태', type: 'CODE', required: true},
  {name: 'packagehash', label: '패키지 SHA-256', type: 'TEXT', required: true},
  {name: 'receiptno', label: '기관 접수번호', type: 'TEXT', required: false},
  {name: 'correctionreason', label: '보완 사유', type: 'TEXT', required: false},
  {name: 'correctionduedate', label: '보완 제출 기한', type: 'DATE', required: false},
  {name: 'note', label: '처리 메모', type: 'TEXT', required: false},
  {name: 'submittedby', label: '제출자', type: 'TEXT', required: false},
  {name: 'submittedat', label: '제출 일시', type: 'DATETIME', required: false},
  {name: 'receivedat', label: '접수 일시', type: 'DATETIME', required: false},
  {name: 'acceptedat', label: '수리 일시', type: 'DATETIME', required: false},
  {name: 'createdby', label: '패키지 생성자', type: 'TEXT', required: true},
  {name: 'updatedat', label: '최종 변경 일시', type: 'DATETIME', required: true},
  {name: 'eventid', label: '이벤트 ID', type: 'TEXT', required: true},
  {name: 'eventcode', label: '처리 명령', type: 'CODE', required: true},
  {name: 'previousstatus', label: '이전 상태', type: 'CODE', required: false},
  {name: 'newstatus', label: '변경 상태', type: 'CODE', required: true},
  {name: 'eventactor', label: '처리 계정', type: 'TEXT', required: true},
  {name: 'eventnote', label: '처리 사유', type: 'TEXT', required: false},
  {name: 'eventcreatedat', label: '처리 일시', type: 'DATETIME', required: true},
];

const Screen262: React.FC = () => {
  // Screen component
  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5">제출 범위 기한 확인</Typography>
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

export default Screen262;