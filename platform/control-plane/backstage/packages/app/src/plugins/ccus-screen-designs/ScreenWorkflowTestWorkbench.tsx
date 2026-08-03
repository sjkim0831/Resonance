import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchApiRef, useApi } from '@backstage/core-plugin-api';
import {
  Box,
  Button,
  Chip,
  FormControl,
  Grid,
  InputLabel,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  TextField,
  Typography,
} from '@material-ui/core';
import LaunchIcon from '@material-ui/icons/Launch';
import SaveIcon from '@material-ui/icons/Save';

type Row = Record<string, unknown>;
type Props = { processes: Row[]; projectId: string };
const text = (row: Row | undefined, key: string) => String(row?.[key] ?? '');
const rows = (value: unknown) => (Array.isArray(value) ? (value as Row[]) : []);

function capabilityMatches(binding: Row | undefined, capability: Row) {
  const command = text(binding, 'commandCode');
  const code = text(capability, 'capabilityCode');
  if (!command) return true;
  if (command === code) return true;
  const contract = capability.commandContract;
  return JSON.stringify(contract ?? '').includes(command);
}

export function ScreenWorkflowTestWorkbench({ processes, projectId }: Props) {
  const fetchApi = useApi(fetchApiRef);
  const base = '/api/resonance-projects/actor-process';
  const workTypes = useMemo(
    () => [...new Set(processes.map(row => text(row, 'domainCode')).filter(Boolean))].sort(),
    [processes],
  );
  const [workType, setWorkType] = useState('');
  const [processCode, setProcessCode] = useState('');
  const [screens, setScreens] = useState<Row[]>([]);
  const [screenId, setScreenId] = useState('');
  const [detail, setDetail] = useState<Row>();
  const [stepCode, setStepCode] = useState('');
  const [capabilityCode, setCapabilityCode] = useState('');
  const [caseName, setCaseName] = useState('기능별 정상 처리');
  const [caseId, setCaseId] = useState('');
  const [cases, setCases] = useState<Row[]>([]);
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [result, setResult] = useState<Row>();
  const [preview, setPreview] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const filteredProcesses = useMemo(
    () => processes.filter(row => !workType || text(row, 'domainCode') === workType),
    [processes, workType],
  );
  const selectedScreen = screens.find(row => text(row, 'itemId') === screenId);
  const bindings = useMemo(
    () => rows(detail?.bindings).filter(row => text(row, 'processCode') === processCode),
    [detail, processCode],
  );
  const steps = useMemo(
    () => [...new Map(bindings.map(row => [text(row, 'stepCode'), row])).values()],
    [bindings],
  );
  const binding = steps.find(row => text(row, 'stepCode') === stepCode);
  const capabilities = useMemo(
    () => rows(detail?.capabilities).filter(row => capabilityMatches(binding, row)),
    [binding, detail],
  );
  const fields = useMemo(() => {
    const scoped = rows(detail?.stepFields).filter(
      row => text(row, 'processCode') === processCode && text(row, 'stepCode') === stepCode,
    );
    const source = scoped.length ? scoped : rows(detail?.fields);
    return [...new Map(source.map(row => [text(row, 'fieldCode'), row])).values()];
  }, [detail, processCode, stepCode]);
  const checks = rows(result?.checks);
  const routePath = text(selectedScreen, 'routePath');
  const previewPath = routePath
    ? `http://172.16.1.232${routePath}${routePath.includes('?') ? '&' : '?'}step=${stepCode.toLowerCase()}`
    : '';

  useEffect(() => {
    if (!workType && workTypes.length) setWorkType(workTypes[0]);
  }, [workType, workTypes]);
  useEffect(() => {
    if (!filteredProcesses.some(row => text(row, 'processCode') === processCode)) {
      setProcessCode(text(filteredProcesses[0], 'processCode'));
    }
  }, [filteredProcesses, processCode]);

  const loadScreens = useCallback(async () => {
    if (!processCode) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetchApi.fetch(`${base}/page-development-master?processCode=${encodeURIComponent(processCode)}`, { cache: 'no-store' });
      const payload = (await response.json()) as Row;
      if (!response.ok) throw new Error(text(payload, 'message') || '화면 목록을 불러오지 못했습니다.');
      setScreens(rows(payload.items));
      setScreenId('');
      setDetail(undefined);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  }, [fetchApi, processCode]);
  useEffect(() => { void loadScreens(); }, [loadScreens]);

  const selectScreen = async (id: string) => {
    setScreenId(id);
    setBusy(true);
    setError('');
    try {
      const response = await fetchApi.fetch(`${base}/page-development-master/${id}`, { cache: 'no-store' });
      const payload = (await response.json()) as Row;
      if (!response.ok) throw new Error(text(payload, 'message') || '화면 계약을 불러오지 못했습니다.');
      setDetail(payload);
      const first = rows(payload.bindings).find(row => text(row, 'processCode') === processCode);
      setStepCode(text(first, 'stepCode'));
      setResult(undefined);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!steps.some(row => text(row, 'stepCode') === stepCode)) setStepCode(text(steps[0], 'stepCode'));
  }, [stepCode, steps]);
  useEffect(() => {
    if (!capabilities.some(row => text(row, 'capabilityCode') === capabilityCode)) {
      setCapabilityCode(text(capabilities[0], 'capabilityCode'));
    }
  }, [capabilities, capabilityCode]);
  useEffect(() => {
    setInputs(current => Object.fromEntries(fields.map(field => {
      const code = text(field, 'fieldCode');
      const defaultValue = code === 'projectId' ? projectId : current[code] ?? '';
      return [code, defaultValue];
    })));
    setCaseId('');
    setResult(undefined);
  }, [fields, capabilityCode, projectId]);

  const loadCases = useCallback(async () => {
    if (!selectedScreen || !stepCode || !capabilityCode) return;
    const query = new URLSearchParams({
      screenResourceId: text(selectedScreen, 'screenResourceId'),
      processCode,
      stepCode,
      capabilityCode,
    });
    const response = await fetchApi.fetch(`${base}/screen-workflow-test-cases?${query}`, { cache: 'no-store' });
    const payload = (await response.json()) as Row;
    if (!response.ok) throw new Error(text(payload, 'message') || '저장 테스트 케이스를 불러오지 못했습니다.');
    setCases(rows(payload.items));
  }, [capabilityCode, fetchApi, processCode, selectedScreen, stepCode]);
  useEffect(() => { void loadCases().catch(reason => setError(reason instanceof Error ? reason.message : String(reason))); }, [loadCases]);

  const saveCase = async () => {
    if (!selectedScreen || !stepCode || !capabilityCode) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetchApi.fetch(`${base}/screen-workflow-test-cases`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          screenResourceId: Number(text(selectedScreen, 'screenResourceId')),
          processCode,
          stepCode,
          capabilityCode,
          caseName,
          preInputJson: JSON.stringify(inputs),
          expectedResult: 'PASSED',
        }),
      });
      const payload = (await response.json()) as Row;
      if (!response.ok) throw new Error(text(payload, 'message') || '기능 데이터셋 저장에 실패했습니다.');
      setCaseId(text(payload, 'testCaseId'));
      await loadCases();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  };

  const runTest = async () => {
    if (!selectedScreen || !stepCode || !capabilityCode) return;
    setBusy(true);
    setError('');
    if (preview) {
      setPreview(false);
      await new Promise(resolve => window.setTimeout(resolve, 150));
    }
    try {
      const response = await fetchApi.fetch(`${base}/screen-workflow-test`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          itemId: Number(text(selectedScreen, 'itemId')),
          processCode,
          stepCode,
          capabilityCode,
          testCaseId: caseId ? Number(caseId) : undefined,
          preInputJson: JSON.stringify(inputs),
        }),
      });
      const payload = (await response.json()) as Row;
      if (!response.ok) throw new Error(text(payload, 'message') || '화면 기능 테스트에 실패했습니다.');
      setResult(payload);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box mt={3}>
      {busy && <LinearProgress />}
      <Paper variant="outlined" style={{ padding: 20, background: '#f5f9ff' }}>
        <Typography variant="overline" color="primary">AI-INDEPENDENT SCREEN TEST WORKBENCH</Typography>
        <Typography variant="h5">업무부터 기능 데이터셋까지 선택하는 화면 테스트</Typography>
        <Typography variant="body2" color="textSecondary">
          업무 종류 → 프로세스 → 화면 → 절차 → 기능 순서로 선택하고 동일한 Resonance 계약과 DB를 사용합니다.
        </Typography>
        <Grid container spacing={2} style={{ marginTop: 4 }}>
          {[
            ['1. 업무 종류', workType, setWorkType, workTypes.map(code => [code, code])],
            ['2. 프로세스', processCode, setProcessCode, filteredProcesses.map(row => [text(row, 'processCode'), `${text(row, 'processName')} · ${text(row, 'processCode')}`])],
            ['3. 화면', screenId, (id: string) => void selectScreen(id), screens.map(row => [text(row, 'itemId'), `${text(row, 'screenName')} · ${text(row, 'itemId')}`])],
            ['4. 절차', stepCode, setStepCode, steps.map(row => [text(row, 'stepCode'), `${text(row, 'stepOrder')}. ${text(row, 'stepName')} · ${text(row, 'stepCode')}`])],
            ['5. 기능', capabilityCode, setCapabilityCode, capabilities.map(row => [text(row, 'capabilityCode'), `${text(row, 'capabilityName')} · ${text(row, 'capabilityCode')}`])],
          ].map(([label, selected, setter, options]) => (
            <Grid item xs={12} md key={String(label)}>
              <FormControl variant="outlined" size="small" fullWidth>
                <InputLabel>{String(label)}</InputLabel>
                <Select value={String(selected)} label={String(label)} onChange={event => (setter as (value: string) => void)(String(event.target.value))}>
                  <MenuItem value=""><em>선택</em></MenuItem>
                  {(options as string[][]).map(([code, name]) => <MenuItem key={code} value={code}>{name}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
          ))}
        </Grid>
      </Paper>

      {error && <Box mt={2}><Chip color="secondary" label={error} /></Box>}
      {!detail && <Box mt={2} p={4} textAlign="center" border="1px dashed #b8c5d1"><Typography color="textSecondary">화면을 선택하면 절차·기능·데이터셋·미리보기가 표시됩니다.</Typography></Box>}
      {detail && <>
        <Paper variant="outlined" style={{ padding: 20, marginTop: 16 }}>
          <Box display="flex" justifyContent="space-between" alignItems="flex-start" flexWrap="wrap">
            <Box>
              <Typography variant="h6">{text(selectedScreen, 'screenName')}</Typography>
              <Typography variant="body2">{text(binding, 'stepName')} · {text(capabilities.find(row => text(row, 'capabilityCode') === capabilityCode), 'capabilityName')}</Typography>
            </Box>
            <Box display="flex" gridGap={8} flexWrap="wrap">
              <Button variant="outlined" onClick={() => setPreview(current => !current)}>{preview ? '미리보기 닫기' : '미리보기 열기'}</Button>
              <Button variant="outlined" startIcon={<LaunchIcon />} href={previewPath} target="_blank">실제 화면 열기</Button>
              <Button variant="contained" color="primary" disabled={busy || !capabilityCode} onClick={() => void runTest()}>선택 기능 테스트</Button>
            </Box>
          </Box>
        </Paper>
        {preview && previewPath && <Paper variant="outlined" style={{ overflow: 'hidden', marginTop: 16 }}><Box p={1.5} borderBottom="1px solid #dbe4ea"><Typography variant="subtitle2">실제 화면 미리보기</Typography></Box><iframe title="실제 화면 미리보기" src={previewPath} style={{ width: '100%', height: 520, border: 0 }} /></Paper>}
        <Paper variant="outlined" style={{ padding: 20, marginTop: 16 }}>
          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <FormControl variant="outlined" size="small" fullWidth>
                <InputLabel>저장 테스트 케이스</InputLabel>
                <Select value={caseId} label="저장 테스트 케이스" onChange={event => {
                  const id = String(event.target.value); setCaseId(id);
                  const item = cases.find(row => text(row, 'testCaseId') === id);
                  if (item) { setCaseName(text(item, 'caseName')); try { setInputs(JSON.parse(text(item, 'preInputJson'))); } catch { setError('저장된 선입력 JSON 형식이 올바르지 않습니다.'); } }
                }}>
                  <MenuItem value=""><em>새 테스트 케이스</em></MenuItem>
                  {cases.map(row => <MenuItem key={text(row, 'testCaseId')} value={text(row, 'testCaseId')}>{text(row, 'caseName')} · {text(row, 'capabilityCode')}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}><TextField fullWidth size="small" variant="outlined" label="케이스명" value={caseName} onChange={event => setCaseName(event.target.value)} /></Grid>
            <Grid item xs={12} md={2}><Button fullWidth variant="contained" color="primary" startIcon={<SaveIcon />} disabled={busy} onClick={() => void saveCase()}>데이터셋 저장</Button></Grid>
            {fields.map(field => {
              const code = text(field, 'fieldCode');
              return <Grid item xs={12} md={6} key={code}><TextField fullWidth required={field.required === true} size="small" variant="outlined" label={`${text(field, 'fieldName') || code}${field.required === true ? ' *' : ''}`} helperText={`${text(field, 'fieldGroup')} · ${text(field, 'dataType')} · ${text(field, 'lineageStatus')}`} value={inputs[code] ?? ''} onChange={event => setInputs(current => ({ ...current, [code]: event.target.value }))} /></Grid>;
            })}
          </Grid>
        </Paper>
        {result && <Paper variant="outlined" style={{ padding: 20, marginTop: 16 }}>
          <Box display="flex" alignItems="center" gridGap={8}><Typography variant="h6">테스트 결과</Typography><Chip color={text(result, 'result') === 'PASSED' ? 'primary' : 'secondary'} label={`${text(result, 'result')} · ${text(result, 'passedCheckCount')}/${text(result, 'totalCheckCount')}`} /></Box>
          <Grid container spacing={1} style={{ marginTop: 8 }}>{checks.map((check, index) => <Grid item xs={12} md={6} key={`${text(check, 'code')}-${index}`}><Box p={1.5} border="1px solid #dbe4ea" borderRadius={6}><Typography variant="subtitle2">{check.passed === true ? '통과' : '차단'} · {text(check, 'label')}</Typography><Typography variant="caption" color="textSecondary">{text(check, 'message')}</Typography></Box></Grid>)}</Grid>
        </Paper>}
      </>}
    </Box>
  );
}
