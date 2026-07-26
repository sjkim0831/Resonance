import React, { useState, useEffect, useCallback } from 'react';
import { Box, Container, Typography, Button, Paper, Alert, CircularProgress } from '@mui/material';
import { FieldFactory } from '../templates/FieldFactory';
import { CardSection, StatusChip } from '../templates/SectionComponents';
import { useScreenState, useFormState, useApi } from '../templates/hooks';
import { api, handleApiError } from '../templates/api_client';

// Screen: 배출량 프로젝트
// Route: /emission/project_list
// Contract ID: 739

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
  {name: 'keyword', label: '검색어', type: 'TEXT', required: false},
  {name: 'statusfilter', label: '상태 필터', type: 'CODE', required: false},
  {name: 'sitefilter', label: '사업장 필터', type: 'TEXT', required: false},
  {name: 'page', label: '페이지', type: 'TEXT', required: true},
  {name: 'size', label: '페이지 크기', type: 'TEXT', required: true},
  {name: 'total', label: '검색 결과 수', type: 'TEXT', required: true},
  {name: 'summarystatus', label: '상태별 구분', type: 'CODE', required: false},
  {name: 'summarycount', label: '상태별 건수', type: 'TEXT', required: false},
  {name: 'projectid', label: '프로젝트 ID', type: 'TEXT', required: true},
  {name: 'projectname', label: '프로젝트명', type: 'TEXT', required: true},
  {name: 'sitename', label: '사업장', type: 'TEXT', required: true},
  {name: 'calculationperiod', label: '산정 기간', type: 'TEXT', required: true},
  {name: 'scopename', label: 'Scope', type: 'TEXT', required: true},
  {name: 'ownername', label: '담당자', type: 'TEXT', required: true},
  {name: 'progresspercent', label: '진행률', type: 'TEXT', required: true},
  {name: 'currentstep', label: '현재 단계', type: 'TEXT', required: true},
  {name: 'duedate', label: '마감일', type: 'DATE', required: false},
  {name: 'projectstatus', label: '상태', type: 'CODE', required: true},
  {name: 'tenantid', label: '테넌트', type: 'TEXT', required: true},
  {name: 'actoruserid', label: '로그인 계정', type: 'TEXT', required: true},
  {name: 'actoractiveyn', label: '액터 배정 상태', type: 'TEXT', required: true},
];

const Screen739: React.FC = () => {
  // Screen component
  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5">배출량 프로젝트</Typography>
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

export default Screen739;