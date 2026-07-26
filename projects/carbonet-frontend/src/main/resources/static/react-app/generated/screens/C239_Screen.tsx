import React, { useState, useEffect, useCallback } from 'react';
import { Box, Container, Typography, Button, Paper, Alert, CircularProgress } from '@mui/material';
import { FieldFactory } from '../templates/FieldFactory';
import { CardSection, StatusChip } from '../templates/SectionComponents';
import { useScreenState, useFormState, useApi } from '../templates/hooks';
import { api, handleApiError } from '../templates/api_client';

// Screen: 내 업무 프로젝트 선택
// Route: /emission/my-tasks
// Contract ID: 239

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
  {name: 'actionable', label: '실행 가능 여부', type: 'TEXT', required: true},
  {name: 'actorcode', label: '담당 액터', type: 'TEXT', required: false},
  {name: 'assignee', label: '담당자', type: 'TEXT', required: false},
  {name: 'blockedreason', label: '차단 사유', type: 'TEXT', required: false},
  {name: 'commandcode', label: '실행 명령', type: 'TEXT', required: false},
  {name: 'completionevidence', label: '완료 근거', type: 'TEXT', required: false},
  {name: 'completionrule', label: '완료 조건', type: 'TEXT', required: false},
  {name: 'completionsatisfied', label: '완료 충족 여부', type: 'TEXT', required: false},
  {name: 'domaincode', label: '업무 종류 코드', type: 'TEXT', required: false},
  {name: 'duedate', label: '마감일', type: 'TEXT', required: false},
  {name: 'entrystate', label: '진입 상태', type: 'TEXT', required: false},
  {name: 'expectedoutput', label: '기대 산출물 계약', type: 'TEXT', required: false},
  {name: 'id', label: '업무 ID', type: 'TEXT', required: true},
  {name: 'name', label: '업무명', type: 'TEXT', required: true},
  {name: 'nextactorcode', label: '다음 담당 액터', type: 'TEXT', required: false},
  {name: 'nexttaskname', label: '다음 업무명', type: 'TEXT', required: false},
  {name: 'notificationid', label: '알림 ID', type: 'TEXT', required: false},
  {name: 'notificationmessage', label: '알림 내용', type: 'TEXT', required: false},
  {name: 'notificationreadat', label: '알림 확인 일시', type: 'TEXT', required: false},
  {name: 'notificationtitle', label: '알림 제목', type: 'TEXT', required: false},
  {name: 'pendingpredecessors', label: '미완료 선행업무', type: 'TEXT', required: false},
  {name: 'priority', label: '우선순위', type: 'TEXT', required: true},
  {name: 'processcode', label: '프로세스 코드', type: 'TEXT', required: false},
  {name: 'processname', label: '프로세스명', type: 'TEXT', required: false},
  {name: 'processstepcode', label: '프로세스 단계 코드', type: 'TEXT', required: false},
  {name: 'projectid', label: '프로젝트 ID', type: 'TEXT', required: true},
  {name: 'projectname', label: '프로젝트명', type: 'TEXT', required: true},
  {name: 'requiredinputs', label: '필수 입력 계약', type: 'TEXT', required: false},
  {name: 'site', label: '사업장', type: 'TEXT', required: false},
  {name: 'status', label: '업무 상태', type: 'TEXT', required: true},
  {name: 'steporder', label: '업무 순서', type: 'TEXT', required: true},
  {name: 'summaryapproval', label: '승인 대기 수', type: 'TEXT', required: false},
  {name: 'summarycompleted', label: '완료 업무 수', type: 'TEXT', required: false},
  {name: 'summaryoverdue', label: '지연 업무 수', type: 'TEXT', required: false},
  {name: 'summarytoday', label: '오늘 마감 수', type: 'TEXT', required: false},
  {name: 'summarytotal', label: '전체 업무 수', type: 'TEXT', required: false},
  {name: 'targeturl', label: '업무 화면 경로', type: 'TEXT', required: false},
  {name: 'taskcode', label: '업무 코드', type: 'TEXT', required: true},
  {name: 'type', label: '업무 유형', type: 'TEXT', required: false},
  {name: 'workpurpose', label: '업무 목적', type: 'TEXT', required: false},
];

const Screen239: React.FC = () => {
  // Screen component
  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5">내 업무 프로젝트 선택</Typography>
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

export default Screen239;