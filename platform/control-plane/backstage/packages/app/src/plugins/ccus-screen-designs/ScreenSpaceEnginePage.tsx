import { useEffect, useMemo, useState } from 'react';
import { Content, Header, Page } from '@backstage/core-components';
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
  Tab,
  Tabs,
  TextField,
  Typography,
  makeStyles,
} from '@material-ui/core';
import AddCircleOutlineIcon from '@material-ui/icons/AddCircleOutline';
import CheckCircleIcon from '@material-ui/icons/CheckCircle';
import LaunchIcon from '@material-ui/icons/Launch';
import { CCUS_SCREEN_DESIGN_CATALOG } from './generatedCatalog';
import {
  GENERATION_PIPELINE,
  TARGET_SCREEN_SPACE,
  buildMaterializationOutputs,
  buildScreenCoordinate,
  calculateScreenSpace,
} from './screenSpaceEngine';

const STATES = [
  'DRAFT', 'SUBMITTED', 'IN_REVIEW', 'REVISION_REQUIRED', 'RESUBMITTED',
  'APPROVED', 'REJECTED', 'CANCELLED', 'EXPIRED', 'RECALCULATING',
  'LOCKED', 'ARCHIVED',
];
const ARCHETYPES = [
  'LIST', 'DETAIL', 'CREATE', 'EDIT', 'APPROVAL', 'DASHBOARD',
  'COMPARISON', 'HISTORY', 'WORKFLOW', 'REPORT',
];
const DEVICES = ['DESKTOP', 'TABLET', 'MOBILE'];
const LANGUAGES = ['ko', 'en'];
const PERMISSIONS = [
  'VIEW', 'CREATE', 'EDIT', 'SUBMIT', 'WITHDRAW',
  'REVIEW', 'APPROVE', 'REJECT', 'EXPORT', 'ADMIN',
];
const RULES = [
  ['DATA_INPUT', '이전 화면 출력이 현재 화면 필수 입력을 충족'],
  ['ACTION_COMMAND', '모든 버튼에 명령과 권한 정책 연결'],
  ['STATE_TRANSITION', '시작·종료 상태와 예외 전이 정의'],
  ['ACTOR_POLICY', '액터별 조회·수정·승인·내보내기 정책 정의'],
  ['RECOVERY_PATH', '반려·취소·기한초과·재처리·복구 경로 정의'],
  ['TYPE_CONSISTENCY', '화면·API·DB 필드명과 자료형 일치'],
  ['TENANT_ISOLATION', '프로젝트·기업·계정 데이터 격리'],
  ['ACCESSIBILITY', '키보드·초점·명도·레이블 기준 적용'],
  ['RESPONSIVE', '데스크톱·태블릿·모바일 화면 문법 적용'],
];

type QueueItem = { coordinate: string; seedScreenId: string; createdAt: string };
const unique = (values: string[]) => [...new Set(values)].sort();

const useStyles = makeStyles(theme => ({
  hero: {
    padding: theme.spacing(3), borderRadius: 14, color: '#fff',
    background: 'linear-gradient(125deg,#082f49 0%,#075985 48%,#0f766e 100%)',
    marginBottom: theme.spacing(2),
  },
  metric: {
    height: '100%', padding: theme.spacing(2), border: '1px solid #d9e2e8',
    borderRadius: 12,
  },
  metricValue: {
    color: '#12344d', fontSize: 25, fontWeight: 800, overflowWrap: 'anywhere',
  },
  panel: {
    padding: theme.spacing(2.5), height: '100%', border: '1px solid #d9e2e8',
    borderRadius: 12,
  },
  formGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))',
    gap: theme.spacing(2),
    [theme.breakpoints.down('sm')]: { gridTemplateColumns: '1fr' },
  },
  coordinate: {
    padding: theme.spacing(2), marginTop: theme.spacing(2), borderRadius: 8,
    background: '#eef6f8', color: '#12344d', fontFamily: 'monospace',
    overflowWrap: 'anywhere',
  },
  chips: {
    display: 'flex', flexWrap: 'wrap', gap: theme.spacing(1),
    marginTop: theme.spacing(1),
  },
  rule: {
    display: 'grid', gridTemplateColumns: 'minmax(160px,.6fr) 2fr auto',
    gap: theme.spacing(1), alignItems: 'center', padding: theme.spacing(1.25, 0),
    borderBottom: '1px solid #edf1f3',
    [theme.breakpoints.down('xs')]: { gridTemplateColumns: '1fr auto' },
  },
  queue: {
    padding: theme.spacing(1.5), marginTop: theme.spacing(1),
    border: '1px solid #e3e9ed', borderRadius: 8,
  },
}));

export function ScreenSpaceEnginePage() {
  const classes = useStyles();
  const records = CCUS_SCREEN_DESIGN_CATALOG.records;
  const actors = useMemo(
    () => unique(records.flatMap(item => item.actorCodes)), [records],
  );
  const processes = useMemo(
    () => unique(records.flatMap(item => item.processCodes)), [records],
  );
  const [tab, setTab] = useState(0);
  const [seedId, setSeedId] = useState(records[0]?.screenId ?? '');
  const seed = records.find(item => item.screenId === seedId) ?? records[0];
  const [domainObject, setDomainObject] = useState('CCUS-OBJECT-001');
  const [project, setProject] = useState('CCUS-PLATFORM');
  const [actor, setActor] = useState(actors[0] ?? 'PLATFORM_OPERATOR');
  const [process, setProcess] = useState(processes[0] ?? 'GOVERNANCE_CHANGE');
  const [step, setStep] = useState('STEP-001');
  const [state, setState] = useState(STATES[0]);
  const [action, setAction] = useState('VIEW');
  const [permission, setPermission] = useState(PERMISSIONS[0]);
  const [archetype, setArchetype] = useState(ARCHETYPES[0]);
  const [device, setDevice] = useState(DEVICES[0]);
  const [language, setLanguage] = useState(LANGUAGES[0]);
  const [dataContext, setDataContext] = useState('PROJECT');
  const [queue, setQueue] = useState<QueueItem[]>([]);

  useEffect(() => {
    try {
      const value = localStorage.getItem('ccus-screen-space-queue');
      if (value) setQueue(JSON.parse(value) as QueueItem[]);
    } catch {
      setQueue([]);
    }
  }, []);

  const total = calculateScreenSpace(TARGET_SCREEN_SPACE);
  const coordinateInput = {
    project, domainObject, actor, process, step, state, action, permission,
    archetype, device, language, dataContext,
  };
  const coordinate = buildScreenCoordinate(coordinateInput);
  const outputs = buildMaterializationOutputs(coordinateInput);
  const selectDefinitions: [
    string, string, string[], (value: string) => void,
  ][] = [
    ['액터', actor, actors, setActor],
    ['프로세스', process, processes, setProcess],
    ['상태', state, STATES, setState],
    ['작업', action, ['VIEW', 'CREATE', 'EDIT', 'SUBMIT', 'WITHDRAW', 'RESUBMIT'], setAction],
    ['권한', permission, PERMISSIONS, setPermission],
    ['화면 원형', archetype, ARCHETYPES, setArchetype],
    ['디바이스', device, DEVICES, setDevice],
    ['언어', language, LANGUAGES, setLanguage],
    ['데이터 문맥', dataContext, ['PROJECT', 'COMPANY', 'FACILITY', 'PRODUCT', 'REPORT'], setDataContext],
  ];
  const enqueue = () => {
    if (queue.some(item => item.coordinate === coordinate)) return;
    const next = [{
      coordinate, seedScreenId: seed.screenId, createdAt: new Date().toISOString(),
    }, ...queue].slice(0, 50);
    setQueue(next);
    localStorage.setItem('ccus-screen-space-queue', JSON.stringify(next));
  };

  return (
    <Page themeId="tool">
      <Header
        title="CCUS 초대규모 화면 공간 설계 엔진"
        subtitle="70억 개 이상의 화면 조합을 좌표·규칙·공통 계약으로 설계합니다."
      />
      <Content>
        <Box className={classes.hero}>
          <Typography variant="h5">Screen-Space Runtime</Typography>
          <Typography>
            업무 객체 × 액터 × 프로세스 × 상태 × 화면 원형 × 디바이스 ×
            언어를 조합하고 선택된 좌표만 지연 구체화합니다.
          </Typography>
        </Box>
        <Grid container spacing={2}>
          {[
            ['논리 화면 공간', total.toLocaleString('ko-KR')],
            ['구체화 설계', records.length.toLocaleString('ko-KR')],
            ['액터', actors.length], ['프로세스', processes.length],
            ['상태', STATES.length], ['자동 검증', RULES.length],
          ].map(([label, value]) => (
            <Grid item xs={6} sm={4} lg={2} key={String(label)}>
              <Paper className={classes.metric} elevation={0}>
                <Typography variant="caption">{label}</Typography>
                <Typography className={classes.metricValue}>{value}</Typography>
              </Paper>
            </Grid>
          ))}
        </Grid>
        <Box mt={3}>
          <Paper>
            <Tabs value={tab} onChange={(_, value) => setTab(value)}
              indicatorColor="primary" textColor="primary" variant="scrollable">
              <Tab label="화면 좌표 설계" />
              <Tab label="규칙·검증" />
              <Tab label="10분 생성 파이프라인" />
              <Tab label={`구체화 대기열 ${queue.length}`} />
            </Tabs>
          </Paper>
        </Box>

        {tab === 0 && (
          <Grid container spacing={2}>
            <Grid item xs={12} lg={7}>
              <Paper className={classes.panel} elevation={0}>
                <Typography variant="h6">화면 좌표 조합</Typography>
                <Typography variant="body2" color="textSecondary">
                  기존 1,000개 설계를 원형으로 선택하고 실행 문맥을 조합합니다.
                </Typography>
                <Box className={classes.formGrid} mt={2}>
                  <FormControl variant="outlined" size="small">
                    <InputLabel>기존 설계 원형</InputLabel>
                    <Select label="기존 설계 원형" value={seedId}
                      onChange={event => setSeedId(event.target.value as string)}>
                      {records.map(item => (
                        <MenuItem value={item.screenId} key={item.screenId}>
                          #{item.sequence} {item.screenName}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <TextField variant="outlined" size="small" label="업무 객체 좌표"
                    value={domainObject}
                    onChange={event => setDomainObject(event.target.value)}
                    helperText="Entity와 Data Context를 결합하는 논리 좌표" />
                  <TextField variant="outlined" size="small" label="프로젝트"
                    value={project}
                    onChange={event => setProject(event.target.value)} />
                  <TextField variant="outlined" size="small" label="프로세스 단계"
                    value={step}
                    onChange={event => setStep(event.target.value)} />
                  {selectDefinitions.map(([label, value, options, setter]) => (
                    <FormControl variant="outlined" size="small" key={label}>
                      <InputLabel>{label}</InputLabel>
                      <Select label={label} value={value}
                        onChange={event => setter(event.target.value as string)}>
                        {options.map(option => (
                          <MenuItem value={option} key={option}>{option}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  ))}
                </Box>
                <Box className={classes.coordinate}>
                  <Typography variant="caption">SCREEN COORDINATE</Typography>
                  <Typography variant="body2">{coordinate}</Typography>
                </Box>
                <Box mt={2} display="flex" flexWrap="wrap" style={{ gap: 8 }}>
                  <Button variant="contained" color="primary"
                    startIcon={<AddCircleOutlineIcon />} onClick={enqueue}>
                    구체화 대기열에 추가
                  </Button>
                  <Button startIcon={<LaunchIcon />} href="/ccus-screen-designs">
                    1,000개 설계 카탈로그
                  </Button>
                </Box>
              </Paper>
            </Grid>
            <Grid item xs={12} lg={5}>
              <Paper className={classes.panel} elevation={0}>
                <Typography variant="h6">설계 미리보기</Typography>
                <Box className={classes.coordinate}>
                  <Typography variant="overline">
                    {seed.domain} · {archetype} · {state}
                  </Typography>
                  <Typography variant="h5">{seed.screenName}</Typography>
                  <Typography variant="body2">{seed.routePath}</Typography>
                </Box>
                <Box mt={2}>
                  <Typography variant="subtitle2">적용 섹션</Typography>
                  <Box className={classes.chips}>
                    {seed.sections.map(value => (
                      <Chip size="small" key={value} label={value} />
                    ))}
                  </Box>
                </Box>
                <Box mt={2}>
                  <Typography variant="subtitle2">공통 데이터 계약</Typography>
                  <Box className={classes.chips}>
                    {seed.dataContracts.map(value => (
                      <Chip size="small" variant="outlined" key={value}
                        label={value} />
                    ))}
                  </Box>
                </Box>
                <Box mt={2}>
                  <Typography variant="subtitle2">실행 정책</Typography>
                  <Typography variant="body2">
                    {actor}가 {process}의 {state} 상태에서 {device}/{language}
                    화면으로 실행
                  </Typography>
                </Box>
                <Box mt={2}>
                  <Typography variant="subtitle2">생성 산출물 계약</Typography>
                  <Box className={classes.chips}>
                    {Object.values(outputs).map(value => (
                      <Chip size="small" variant="outlined" key={value}
                        label={value} />
                    ))}
                  </Box>
                </Box>
              </Paper>
            </Grid>
          </Grid>
        )}

        {tab === 1 && (
          <Grid container spacing={2}>
            <Grid item xs={12} md={8}>
              <Paper className={classes.panel} elevation={0}>
                <Typography variant="h6">설계 정합성 게이트</Typography>
                {RULES.map(([code, description]) => (
                  <Box className={classes.rule} key={code}>
                    <Typography variant="subtitle2">{code}</Typography>
                    <Typography variant="body2">{description}</Typography>
                    <Chip size="small" color="primary" icon={<CheckCircleIcon />}
                      label="ENFORCED" />
                  </Box>
                ))}
              </Paper>
            </Grid>
            <Grid item xs={12} md={4}>
              <Paper className={classes.panel} elevation={0}>
                <Typography variant="h6">지연 구체화 원칙</Typography>
                <Typography variant="body2">
                  전체 조합에는 공통 규칙만 적용하고 사용·검토·승인된 좌표만
                  명세와 코드로 생성합니다.
                </Typography>
                <Box mt={3}>
                  <Typography variant="h6">변경 영향 분석</Typography>
                  <Typography variant="body2">
                    원형·계약·권한·상태 전이를 수정하면 해당 차원을 참조하는
                    좌표만 다시 검증합니다.
                  </Typography>
                </Box>
              </Paper>
            </Grid>
          </Grid>
        )}

        {tab === 2 && (
          <Grid container spacing={2}>
            {GENERATION_PIPELINE.map((stage, index) => (
              <Grid item xs={12} md={6} lg={4} key={stage.code}>
                <Paper className={classes.panel} elevation={0}>
                  <Typography variant="overline">
                    {index + 1}단계 · {stage.minuteRange}
                  </Typography>
                  <Typography variant="h6">{stage.name}</Typography>
                  <Typography variant="caption">{stage.code}</Typography>
                  <Box className={classes.chips}>
                    {stage.outputs.map(output => (
                      <Chip size="small" key={output} label={output} />
                    ))}
                  </Box>
                </Paper>
              </Grid>
            ))}
          </Grid>
        )}

        {tab === 3 && (
          <Paper className={classes.panel} elevation={0}>
            <Box display="flex" justifyContent="space-between" alignItems="center">
              <Box>
                <Typography variant="h6">지연 구체화 대기열</Typography>
                <Typography variant="body2" color="textSecondary">
                  승인 후 화면 명세·API 계약·테스트 생성기로 전달할 좌표입니다.
                </Typography>
              </Box>
              <Button onClick={() => {
                setQueue([]);
                localStorage.removeItem('ccus-screen-space-queue');
              }}>대기열 초기화</Button>
            </Box>
            {queue.length ? queue.map(item => (
              <Box className={classes.queue} key={item.coordinate}>
                <Typography variant="body2" style={{ fontFamily: 'monospace' }}>
                  {item.coordinate}
                </Typography>
                <Typography variant="caption">
                  원형 {item.seedScreenId} ·{' '}
                  {new Date(item.createdAt).toLocaleString('ko-KR')}
                </Typography>
              </Box>
            )) : (
              <Box py={6} textAlign="center">
                <Typography color="textSecondary">구체화 요청이 없습니다.</Typography>
              </Box>
            )}
          </Paper>
        )}
      </Content>
    </Page>
  );
}
