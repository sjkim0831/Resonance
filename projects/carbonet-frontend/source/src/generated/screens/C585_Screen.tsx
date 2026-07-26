import React, { useState, useEffect, useCallback } from 'react';
import { Box, Container, Typography, Button, Paper, Alert, CircularProgress } from '@mui/material';
import { FieldFactory } from '../templates/FieldFactory';
import { CardSection, StatusChip } from '../templates/SectionComponents';
import { useScreenState, useFormState, useApi } from '../templates/hooks';
import { api, handleApiError } from '../templates/api_client';

// Screen: 인증서 PDF 발급 관리
// Route: /admin/emission/survey-report-print
// Contract ID: 585

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
  {name: 'certificateid', label: '인증서 ID', type: 'TEXT', required: true},
  {name: 'payloadversion', label: '검증 페이로드 버전', type: 'TEXT', required: true},
  {name: 'issuedat', label: '발급 일시', type: 'DATETIME', required: true},
  {name: 'reporttitle', label: '리포트 제목', type: 'TEXT', required: true},
  {name: 'productname', label: '제품명', type: 'TEXT', required: true},
  {name: 'generatedat', label: '산정 결과 생성 일시', type: 'DATETIME', required: true},
  {name: 'totalemission', label: '총 탄소배출량', type: 'TEXT', required: true},
  {name: 'rowcount', label: '전체 인벤토리 행 수', type: 'TEXT', required: true},
  {name: 'calculatedrowcount', label: '산정 완료 행 수', type: 'TEXT', required: true},
  {name: 'warningcount', label: '검토 경고 수', type: 'TEXT', required: true},
  {name: 'payloadhash', label: '페이로드 해시', type: 'TEXT', required: true},
  {name: 'integritycode', label: '무결성 코드', type: 'TEXT', required: true},
  {name: 'datasethash', label: '데이터셋 해시', type: 'TEXT', required: true},
  {name: 'dataset', label: '정규화 데이터셋', type: 'TEXT', required: true},
  {name: 'issuerid', label: '발급 담당자', type: 'TEXT', required: true},
  {name: 'statuscode', label: '발급 상태', type: 'CODE', required: true},
  {name: 'registrycreatedat', label: '원장 등록 일시', type: 'DATETIME', required: true},
  {name: 'registryupdatedat', label: '원장 수정 일시', type: 'DATETIME', required: true},
  {name: 'visualprofile', label: 'PDF 시각 지문', type: 'TEXT', required: true},
  {name: 'visualprofileversion', label: '시각 지문 버전', type: 'TEXT', required: true},
  {name: 'visualprofileupdatedat', label: '시각 지문 등록 일시', type: 'DATETIME', required: true},
  {name: 'displaytitle', label: '표지 유형명', type: 'TEXT', required: true},
  {name: 'classificationmajor', label: '대분류', type: 'TEXT', required: false},
  {name: 'classificationmiddle', label: '중분류', type: 'TEXT', required: false},
  {name: 'classificationsmall', label: '소분류', type: 'TEXT', required: false},
  {name: 'scopecategory', label: '산정 범주', type: 'TEXT', required: true},
  {name: 'scopetier', label: '산정 Tier', type: 'TEXT', required: true},
  {name: 'factorcount', label: '배출계수 수', type: 'TEXT', required: true},
  {name: 'outputquantitytotal', label: '총 산출물 질량', type: 'TEXT', required: true},
  {name: 'normalizationfactor', label: '정규화 배율', type: 'TEXT', required: true},
  {name: 'normalizationapplied', label: '정규화 적용 여부', type: 'TEXT', required: true},
  {name: 'dataconfidence', label: '데이터 신뢰도', type: 'TEXT', required: true},
  {name: 'topcontributorlabel', label: '최대 기여 항목', type: 'TEXT', required: false},
  {name: 'topcontributorsharepercent', label: '최대 기여율', type: 'TEXT', required: false},
  {name: 'sectionsummaries', label: '섹션별 기여도', type: 'TEXT', required: true},
  {name: 'totalcarbonemission', label: '검증 총 탄소배출량', type: 'TEXT', required: true},
  {name: 'productgwp', label: '제품 GWP', type: 'TEXT', required: true},
  {name: 'processgwp', label: '공정 GWP', type: 'TEXT', required: true},
  {name: 'byproductallocation', label: '부산물 할당 방식', type: 'CODE', required: true},
  {name: 'outputrows', label: '제품·부산물 배출 결과', type: 'TEXT', required: true},
  {name: 'inventoryrows', label: '상세 계산 인벤토리', type: 'TEXT', required: true},
  {name: 'scenarios', label: '시나리오 비교', type: 'TEXT', required: false},
  {name: 'alerts', label: '검토 경고', type: 'TEXT', required: false},
  {name: 'reporttype', label: '리포트 유형', type: 'CODE', required: true},
];

const Screen585: React.FC = () => {
  // Screen component
  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5">인증서 PDF 발급 관리</Typography>
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

export default Screen585;