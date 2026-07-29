import { useEffect, useMemo, useState } from 'react';
import { Content, Header, Page } from '@backstage/core-components';
import { fetchApiRef, useApi } from '@backstage/core-plugin-api';
import {
  Box,
  Button,
  Chip,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Typography,
  makeStyles,
} from '@material-ui/core';
import AddCircleOutlineIcon from '@material-ui/icons/AddCircleOutline';
import CheckCircleIcon from '@material-ui/icons/CheckCircle';
import ErrorOutlineIcon from '@material-ui/icons/ErrorOutline';
import LaunchIcon from '@material-ui/icons/Launch';
import { CCUS_SCREEN_DESIGN_CATALOG } from './generatedCatalog';
import {
  TARGET_SCREEN_SPACE,
  buildScreenCoordinate,
  calculateScreenSpace,
} from './screenSpaceEngine';

type WorkStage = {
  sequence: number;
  step: string;
  name: string;
  actor: string;
  process: string;
  routePath: string;
  archetype: string;
  inputContract: string[];
  outputContract: string[];
  completionCondition: string;
};

type SavedSpec = {
  coordinate: string;
  routePath: string;
  actor: string;
  process: string;
  step: string;
  status: string;
  specSha256: string;
  updatedAt: string;
};

const STATES = [
  'DRAFT',
  'IN_PROGRESS',
  'SUBMITTED',
  'IN_REVIEW',
  'REVISION_REQUIRED',
  'APPROVED',
];
const DEVICES = ['DESKTOP', 'TABLET', 'MOBILE'];
const LANGUAGES = ['ko', 'en'];

const useStyles = makeStyles(theme => ({
  hero: {
    padding: theme.spacing(3),
    borderRadius: 16,
    color: '#fff',
    background: 'linear-gradient(125deg,#0b3558 0%,#075985 52%,#0f766e 100%)',
  },
  metric: {
    height: '100%',
    padding: theme.spacing(2),
    border: '1px solid #d7e1e8',
    borderRadius: 12,
  },
  metricValue: { fontSize: 24, fontWeight: 800, color: '#12344d' },
  panel: {
    padding: theme.spacing(2.5),
    border: '1px solid #d7e1e8',
    borderRadius: 12,
    height: '100%',
  },
  stages: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7,minmax(170px,1fr))',
    gap: theme.spacing(1),
    overflowX: 'auto',
    paddingBottom: theme.spacing(1),
  },
  stage: {
    minWidth: 170,
    padding: theme.spacing(1.5),
    border: '1px solid #d7e1e8',
    borderRadius: 10,
    cursor: 'pointer',
    position: 'relative',
    '&:not(:last-child)::after': {
      content: '"→"',
      position: 'absolute',
      right: -11,
      top: '42%',
      color: '#64748b',
      zIndex: 2,
    },
  },
  selected: {
    borderColor: '#0369a1',
    background: '#eff8ff',
    boxShadow: 'inset 0 0 0 1px #0369a1',
  },
  coordinate: {
    padding: theme.spacing(1.5),
    borderRadius: 8,
    background: '#edf5f7',
    fontFamily: 'monospace',
    overflowWrap: 'anywhere',
  },
  form: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2,minmax(0,1fr))',
    gap: theme.spacing(1.5),
    [theme.breakpoints.down('sm')]: { gridTemplateColumns: '1fr' },
  },
  spec: {
    padding: theme.spacing(1.5),
    borderBottom: '1px solid #edf1f3',
  },
}));

export function ScreenSpaceRuntimePage() {
  const classes = useStyles();
  const fetchApi = useApi(fetchApiRef);
  const records = CCUS_SCREEN_DESIGN_CATALOG.records;
  const [stages, setStages] = useState<WorkStage[]>([]);
  const [specs, setSpecs] = useState<SavedSpec[]>([]);
  const [selectedStep, setSelectedStep] = useState('EMISSION_PROJECT_SETUP');
  const [seedId, setSeedId] = useState(records[0]?.screenId ?? '');
  const [state, setState] = useState('DRAFT');
  const [device, setDevice] = useState('DESKTOP');
  const [language, setLanguage] = useState('ko');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const stage = stages.find(item => item.step === selectedStep) ?? stages[0];
  const seed = records.find(item => item.screenId === seedId) ?? records[0];
  const action =
    stage?.archetype === 'APPROVAL'
      ? 'APPROVE'
      : stage?.archetype === 'CREATE'
      ? 'CREATE'
      : 'VIEW';
  const permission = action;
  const coordinateInput = useMemo(
    () => ({
      project: 'CCUS-PLATFORM',
      domainObject: 'EMISSION_PROJECT',
      actor: stage?.actor ?? 'COMPANY_MANAGER',
      process: stage?.process ?? 'EMISSION_PROJECT',
      step: stage?.step ?? 'EMISSION_PROJECT_SETUP',
      state,
      action,
      permission,
      archetype: stage?.archetype ?? 'WORKFLOW',
      device,
      language,
      dataContext: 'PROJECT',
    }),
    [action, device, language, permission, stage, state],
  );
  const coordinate = buildScreenCoordinate(coordinateInput);

  const loadSpecs = async () => {
    const response = await fetchApi.fetch(
      '/api/resonance-projects/screen-space/specs?projectId=CCUS-PLATFORM',
    );
    if (!response.ok) return;
    const payload = (await response.json()) as { specs?: SavedSpec[] };
    setSpecs(payload.specs ?? []);
  };

  useEffect(() => {
    void fetchApi
      .fetch('/api/resonance-projects/screen-space/work-pack/emission')
      .then(response => response.json())
      .then((payload: { stages?: WorkStage[] }) =>
        setStages(payload.stages ?? []),
      )
      .catch(() => setMessage('대표 배출량 업무팩을 불러오지 못했습니다.'));
    void loadSpecs();
  }, [fetchApi]);

  const materialize = async () => {
    if (!stage || !seed) return;
    setSaving(true);
    setMessage('화면 좌표와 계약을 검증하고 있습니다.');
    const response = await fetchApi.fetch(
      '/api/resonance-projects/screen-space/materialize',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          projectId: 'CCUS-PLATFORM',
          domainObject: 'EMISSION_PROJECT',
          actor: stage.actor,
          process: stage.process,
          step: stage.step,
          state,
          action,
          permission,
          archetype: stage.archetype,
          device,
          language,
          dataContext: 'PROJECT',
          seedScreenId: seed.screenId,
          routePath: stage.routePath,
          sections: seed.sections,
          dataContracts: [
            ...seed.dataContracts,
            ...stage.inputContract,
            ...stage.outputContract,
          ],
        }),
      },
    );
    const payload = (await response.json()) as {
      validation?: { checks?: { code: string; status: string }[] };
    };
    setSaving(false);
    if (!response.ok) {
      const failed = payload.validation?.checks
        ?.filter(check => check.status === 'FAIL')
        .map(check => check.code)
        .join(', ');
      setMessage(`구체화 차단: ${failed || '계약을 확인하세요.'}`);
      return;
    }
    setMessage(
      '검증된 화면 명세를 DB에 저장했습니다. 런타임에서 즉시 조립할 수 있습니다.',
    );
    await loadSpecs();
  };

  const total = calculateScreenSpace(TARGET_SCREEN_SPACE);
  return (
    <Page themeId="tool">
      <Header
        title="CCUS 가상 화면 공간 실행엔진"
        subtitle="화면 파일을 복제하지 않고 액터·프로세스·상태·권한·디바이스 좌표로 화면 명세를 조립합니다."
      />
      <Content>
        <Box className={classes.hero}>
          <Typography variant="h5">Screen-Space Runtime</Typography>
          <Typography>
            Backstage는 설계와 검증을 관리하고 Resonance는 검증된 좌표만 지연
            구체화합니다.
          </Typography>
        </Box>
        <Box mt={2}>
          <Grid container spacing={2}>
            {[
              ['표현 가능한 화면 조합', total.toLocaleString('ko-KR')],
              ['등록 화면 원형', records.length.toLocaleString('ko-KR')],
              ['대표 업무 단계', stages.length],
              ['구체화된 명세', specs.length],
            ].map(([label, value]) => (
              <Grid item xs={6} md={3} key={String(label)}>
                <Paper className={classes.metric} elevation={0}>
                  <Typography variant="caption">{label}</Typography>
                  <Typography className={classes.metricValue}>
                    {value}
                  </Typography>
                </Paper>
              </Grid>
            ))}
          </Grid>
        </Box>

        <Box mt={3}>
          <Paper className={classes.panel} elevation={0}>
            <Typography variant="h6">배출량 프로젝트 대표 업무팩</Typography>
            <Typography variant="body2" color="textSecondary">
              프로젝트 생성부터 인증서 진위 확인까지 출력과 입력 계약이
              연속되도록 구성했습니다.
            </Typography>
            <Box className={classes.stages} mt={2}>
              {stages.map(item => (
                <Box
                  key={item.step}
                  className={`${classes.stage} ${
                    item.step === selectedStep ? classes.selected : ''
                  }`}
                  onClick={() => setSelectedStep(item.step)}
                >
                  <Typography variant="overline">
                    STEP {item.sequence}
                  </Typography>
                  <Typography variant="subtitle2">{item.name}</Typography>
                  <Typography variant="caption">{item.actor}</Typography>
                  <Box mt={1}>
                    <Chip size="small" label={item.archetype} />
                  </Box>
                </Box>
              ))}
            </Box>
          </Paper>
        </Box>

        <Box mt={2}>
          <Grid container spacing={2}>
            <Grid item xs={12} lg={7}>
              <Paper className={classes.panel} elevation={0}>
                <Typography variant="h6">화면 좌표와 원형 선택</Typography>
                <Box className={classes.form} mt={2}>
                  <FormControl variant="outlined" size="small">
                    <InputLabel>기존 화면 원형</InputLabel>
                    <Select
                      value={seedId}
                      label="기존 화면 원형"
                      onChange={event => setSeedId(String(event.target.value))}
                    >
                      {records.map(item => (
                        <MenuItem key={item.screenId} value={item.screenId}>
                          #{item.sequence} {item.screenName}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <FormControl variant="outlined" size="small">
                    <InputLabel>상태</InputLabel>
                    <Select
                      value={state}
                      label="상태"
                      onChange={event => setState(String(event.target.value))}
                    >
                      {STATES.map(option => (
                        <MenuItem key={option} value={option}>
                          {option}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <FormControl variant="outlined" size="small">
                    <InputLabel>디바이스</InputLabel>
                    <Select
                      value={device}
                      label="디바이스"
                      onChange={event => setDevice(String(event.target.value))}
                    >
                      {DEVICES.map(option => (
                        <MenuItem key={option} value={option}>
                          {option}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <FormControl variant="outlined" size="small">
                    <InputLabel>언어</InputLabel>
                    <Select
                      value={language}
                      label="언어"
                      onChange={event =>
                        setLanguage(String(event.target.value))
                      }
                    >
                      {LANGUAGES.map(option => (
                        <MenuItem key={option} value={option}>
                          {option}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Box>
                <Box className={classes.coordinate} mt={2}>
                  <Typography variant="caption">SCREEN COORDINATE</Typography>
                  <Typography variant="body2">{coordinate}</Typography>
                </Box>
                {stage && (
                  <Box mt={2}>
                    <Typography variant="subtitle2">
                      연속 데이터 계약
                    </Typography>
                    <Box display="flex" flexWrap="wrap" style={{ gap: 8 }}>
                      {[...stage.inputContract, ...stage.outputContract].map(
                        item => (
                          <Chip
                            key={item}
                            size="small"
                            variant="outlined"
                            label={item}
                          />
                        ),
                      )}
                    </Box>
                    <Typography variant="body2">
                      완료 조건: {stage.completionCondition}
                    </Typography>
                  </Box>
                )}
                <Box mt={2} display="flex" style={{ gap: 8 }} flexWrap="wrap">
                  <Button
                    variant="contained"
                    color="primary"
                    disabled={saving}
                    startIcon={<AddCircleOutlineIcon />}
                    onClick={materialize}
                  >
                    검증 후 화면 명세 구체화
                  </Button>
                  {stage && (
                    <Button
                      startIcon={<LaunchIcon />}
                      href={`http://172.16.1.232${stage.routePath}`}
                      target="_blank"
                    >
                      Resonance 화면 열기
                    </Button>
                  )}
                </Box>
                {message && (
                  <Box mt={2}>
                    <Typography variant="body2">{message}</Typography>
                  </Box>
                )}
              </Paper>
            </Grid>
            <Grid item xs={12} lg={5}>
              <Paper className={classes.panel} elevation={0}>
                <Typography variant="h6">최근 구체화 명세</Typography>
                {specs.length === 0 ? (
                  <Box py={5} textAlign="center">
                    <Typography color="textSecondary">
                      아직 저장된 화면 명세가 없습니다.
                    </Typography>
                  </Box>
                ) : (
                  specs.slice(0, 10).map(spec => (
                    <Box className={classes.spec} key={spec.coordinate}>
                      <Box display="flex" justifyContent="space-between">
                        <Typography variant="subtitle2">
                          {spec.step} · {spec.actor}
                        </Typography>
                        <Chip
                          size="small"
                          color={
                            spec.status === 'VERIFIED' ? 'primary' : 'default'
                          }
                          icon={
                            spec.status === 'VERIFIED' ? (
                              <CheckCircleIcon />
                            ) : (
                              <ErrorOutlineIcon />
                            )
                          }
                          label={spec.status}
                        />
                      </Box>
                      <Typography variant="caption">
                        {spec.routePath}
                      </Typography>
                      <Typography
                        variant="body2"
                        className={classes.coordinate}
                      >
                        {spec.coordinate}
                      </Typography>
                      <Typography variant="caption">
                        SHA-256 {spec.specSha256.slice(0, 16)}
                      </Typography>
                    </Box>
                  ))
                )}
              </Paper>
            </Grid>
          </Grid>
        </Box>
      </Content>
    </Page>
  );
}
