import React, { useState, useEffect, useCallback } from 'react';
import { Box, Container, Typography, Button, Paper, Alert, CircularProgress } from '@mui/material';
import { FieldFactory } from '../templates/FieldFactory';
import { CardSection, StatusChip } from '../templates/SectionComponents';
import { useScreenState, useFormState, useApi } from '../templates/hooks';
import { api, handleApiError } from '../templates/api_client';

// Screen: 회원 기업 생애주기 자료 입력 업무 수행
// Route: /admin/system/process-workspace?process=MEMBER_LIFECYCLE&step=MEMBER_LIFECYCLE_02_WORK
// Contract ID: 532

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
  {name: 'processcode', label: '프로세스 코드', type: 'TEXT', required: true},
  {name: 'processname', label: '프로세스명', type: 'TEXT', required: true},
  {name: 'domaincode', label: '업무 종류', type: 'CODE', required: true},
  {name: 'processversion', label: '프로세스 버전', type: 'TEXT', required: true},
  {name: 'processgoal', label: '업무 목표', type: 'TEXT', required: true},
  {name: 'startcondition', label: '시작 조건', type: 'TEXT', required: true},
  {name: 'completioncondition', label: '완료 조건', type: 'TEXT', required: true},
  {name: 'owneractorcode', label: '책임 액터', type: 'CODE', required: true},
  {name: 'risklevel', label: '위험도', type: 'CODE', required: true},
  {name: 'slahours', label: '업무 SLA', type: 'TEXT', required: false},
  {name: 'reviewcycledays', label: '검토 주기', type: 'TEXT', required: false},
  {name: 'processstatus', label: '개발 상태', type: 'CODE', required: true},
  {name: 'lifecyclestatus', label: '생명주기 상태', type: 'CODE', required: true},
  {name: 'steporder', label: '단계 순서', type: 'TEXT', required: true},
  {name: 'stepcode', label: '단계 코드', type: 'TEXT', required: true},
  {name: 'stepname', label: '단계명', type: 'TEXT', required: true},
  {name: 'stepactorcode', label: '수행 액터', type: 'CODE', required: true},
  {name: 'fromstate', label: '진입 상태', type: 'CODE', required: true},
  {name: 'commandcode', label: '실행 명령', type: 'CODE', required: true},
  {name: 'tostate', label: '완료 상태', type: 'CODE', required: true},
  {name: 'completionrule', label: '단계 완료 기준', type: 'TEXT', required: true},
  {name: 'requirementtext', label: '단계 요구사항', type: 'TEXT', required: true},
  {name: 'inputcontract', label: '입력 계약', type: 'TEXT', required: true},
  {name: 'outputcontract', label: '출력 계약', type: 'TEXT', required: true},
  {name: 'userpath', label: '사용자 화면', type: 'TEXT', required: false},
  {name: 'adminpath', label: '관리자 화면', type: 'TEXT', required: false},
  {name: 'apicontract', label: 'API 계약', type: 'TEXT', required: false},
  {name: 'automationstatus', label: '자동화 상태', type: 'CODE', required: true},
  {name: 'casecode', label: '테스트 코드', type: 'TEXT', required: true},
  {name: 'casename', label: '테스트명', type: 'TEXT', required: true},
  {name: 'casetype', label: '테스트 유형', type: 'CODE', required: true},
  {name: 'casestatus', label: '테스트 상태', type: 'CODE', required: true},
  {name: 'caseassertions', label: '기대 결과', type: 'TEXT', required: true},
  {name: 'jobid', label: '개발 작업 ID', type: 'TEXT', required: true},
  {name: 'jobtype', label: '개발 작업 유형', type: 'CODE', required: true},
  {name: 'jobname', label: '개발 작업명', type: 'TEXT', required: true},
  {name: 'targetpath', label: '대상 경로', type: 'TEXT', required: false},
  {name: 'jobstatus', label: '개발 진행 상태', type: 'CODE', required: true},
  {name: 'qualitystatus', label: '품질 상태', type: 'CODE', required: true},
  {name: 'jobevidenceref', label: '개발 증빙', type: 'TEXT', required: false},
  {name: 'requiredjobs', label: '필수 작업 수', type: 'TEXT', required: true},
  {name: 'verifiedjobs', label: '검증 완료 작업 수', type: 'TEXT', required: true},
  {name: 'failedjobs', label: '실패 작업 수', type: 'TEXT', required: true},
  {name: 'completionpercent', label: '개발 완료율', type: 'TEXT', required: true},
  {name: 'assurancestatus', label: '설계 보증 상태', type: 'CODE', required: true},
  {name: 'designaccuracyscore', label: '설계 정확도', type: 'TEXT', required: true},
  {name: 'designblockercount', label: '설계 차단 수', type: 'TEXT', required: true},
  {name: 'actorcontractgaps', label: '액터 계약 누락', type: 'TEXT', required: true},
  {name: 'stateflowgaps', label: '상태 전이 누락', type: 'TEXT', required: true},
  {name: 'datacontractgaps', label: '데이터 계약 누락', type: 'TEXT', required: true},
  {name: 'routegaps', label: '화면 경로 누락', type: 'TEXT', required: true},
  {name: 'apicontractgaps', label: 'API 계약 누락', type: 'TEXT', required: true},
  {name: 'approvedsafetytesttypecount', label: '안전 테스트 유형 수', type: 'TEXT', required: true},
  {name: 'nextaction', label: '다음 보완 작업', type: 'TEXT', required: false},
];

const Screen532: React.FC = () => {
  // Screen component
  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5">회원 기업 생애주기 자료 입력 업무 수행</Typography>
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

export default Screen532;