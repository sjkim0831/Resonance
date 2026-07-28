import { useMemo, useState } from 'react';
import { Content, Header, Page } from '@backstage/core-components';
import {
  Box,
  Button,
  Chip,
  Grid,
  Paper,
  Tab,
  Tabs,
  Typography,
  makeStyles,
} from '@material-ui/core';
import AccountTreeIcon from '@material-ui/icons/AccountTree';
import CodeIcon from '@material-ui/icons/Code';
import DashboardIcon from '@material-ui/icons/Dashboard';
import LaunchIcon from '@material-ui/icons/Launch';
import StorageIcon from '@material-ui/icons/Storage';
import {
  RESONANCE_PROJECT_REGISTRY,
  ResonanceProjectRecord,
} from './generatedProjectRegistry';

const useStyles = makeStyles(theme => ({
  hero: {
    padding: theme.spacing(3),
    borderRadius: 14,
    color: '#fff',
    background: 'linear-gradient(120deg,#172554 0%,#075985 52%,#0f766e 100%)',
    marginBottom: theme.spacing(2),
  },
  layout: {
    display: 'grid',
    gridTemplateColumns: 'minmax(260px,320px) minmax(0,1fr)',
    gap: theme.spacing(2),
    [theme.breakpoints.down('sm')]: { gridTemplateColumns: '1fr' },
  },
  project: {
    padding: theme.spacing(2),
    marginBottom: theme.spacing(1),
    border: '1px solid #dbe4ea',
    borderRadius: 10,
    cursor: 'pointer',
  },
  selected: {
    borderColor: '#0369a1',
    background: '#eff8ff',
    boxShadow: 'inset 4px 0 #0369a1',
  },
  panel: {
    padding: theme.spacing(2.5),
    border: '1px solid #dbe4ea',
    borderRadius: 12,
  },
  metric: {
    padding: theme.spacing(2),
    height: '100%',
    border: '1px solid #dbe4ea',
    borderRadius: 10,
  },
  value: { fontWeight: 800, fontSize: 22, color: '#12344d' },
  pipeline: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4,minmax(0,1fr))',
    gap: theme.spacing(1),
    [theme.breakpoints.down('sm')]: { gridTemplateColumns: '1fr 1fr' },
    [theme.breakpoints.down('xs')]: { gridTemplateColumns: '1fr' },
  },
  stage: {
    padding: theme.spacing(2),
    border: '1px solid #dbe4ea',
    borderRadius: 10,
    position: 'relative',
    '&:not(:last-child)::after': {
      content: '"→"',
      position: 'absolute',
      right: -13,
      top: '45%',
      color: '#64748b',
      [theme.breakpoints.down('sm')]: { display: 'none' },
    },
  },
  row: {
    display: 'grid',
    gridTemplateColumns: '180px minmax(0,1fr)',
    gap: theme.spacing(1),
    padding: theme.spacing(1.25, 0),
    borderBottom: '1px solid #edf1f3',
    [theme.breakpoints.down('xs')]: { gridTemplateColumns: '1fr' },
  },
}));

const statusColor = (status: string) =>
  status === 'CONNECTED' || status === 'RUNNING' ? 'primary' : 'default';

function DetailRows({ items }: { items: [string, string][] }) {
  const classes = useStyles();
  return (
    <>
      {items.map(([label, value]) => (
        <Box className={classes.row} key={label}>
          <Typography variant="subtitle2">{label}</Typography>
          <Typography variant="body2" style={{ overflowWrap: 'anywhere' }}>
            {value || '미등록'}
          </Typography>
        </Box>
      ))}
    </>
  );
}

export function ResonanceProjectControlPage() {
  const classes = useStyles();
  const [selectedId, setSelectedId] = useState(
    RESONANCE_PROJECT_REGISTRY[0]?.projectId ?? '',
  );
  const [tab, setTab] = useState(0);
  const selected = useMemo(
    () =>
      RESONANCE_PROJECT_REGISTRY.find(item => item.projectId === selectedId) ??
      RESONANCE_PROJECT_REGISTRY[0],
    [selectedId],
  ) as ResonanceProjectRecord;
  const connected = RESONANCE_PROJECT_REGISTRY.filter(
    item => item.integrationStatus === 'CONNECTED',
  ).length;

  return (
    <Page themeId="tool">
      <Header
        title="Resonance 프로젝트 제어"
        subtitle="프로젝트를 분리 개발하고 승인된 설계와 계약만 공통 프레임워크에 결합합니다."
      />
      <Content>
        <Box className={classes.hero}>
          <Typography variant="h5">Project Control Plane</Typography>
          <Typography>
            설계·개발·운영 정보를 Backstage에서 관리하고 Resonance Runtime은
            검증된 결과만 실행합니다.
          </Typography>
        </Box>
        <Grid container spacing={2}>
          {[
            ['등록 프로젝트', RESONANCE_PROJECT_REGISTRY.length],
            ['운영 연결', connected],
            ['분리 개발', RESONANCE_PROJECT_REGISTRY.length - connected],
            ['공통 프레임워크', 'resonance-core'],
          ].map(([label, value]) => (
            <Grid item xs={6} md={3} key={String(label)}>
              <Paper className={classes.metric} elevation={0}>
                <Typography variant="caption">{label}</Typography>
                <Typography className={classes.value}>{value}</Typography>
              </Paper>
            </Grid>
          ))}
        </Grid>

        <Box className={classes.layout} mt={2}>
          <Paper className={classes.panel} elevation={0}>
            <Typography variant="h6">프로젝트 레지스트리</Typography>
            <Typography variant="body2" color="textSecondary">
              프로젝트 manifest를 배포 시 자동 탐색합니다.
            </Typography>
            <Box mt={2}>
              {RESONANCE_PROJECT_REGISTRY.map(project => (
                <Box
                  className={`${classes.project} ${
                    project.projectId === selectedId ? classes.selected : ''
                  }`}
                  onClick={() => setSelectedId(project.projectId)}
                  key={project.projectId}
                  role="button"
                  tabIndex={0}
                >
                  <Typography variant="overline">{project.projectId}</Typography>
                  <Typography variant="subtitle1">
                    {project.projectName}
                  </Typography>
                  <Chip
                    size="small"
                    label={project.integrationStatus}
                    color={statusColor(project.integrationStatus)}
                  />
                </Box>
              ))}
            </Box>
          </Paper>

          <Box>
            <Paper className={classes.panel} elevation={0}>
              <Box display="flex" justifyContent="space-between" flexWrap="wrap">
                <Box>
                  <Typography variant="overline">{selected.projectId}</Typography>
                  <Typography variant="h5">{selected.projectName}</Typography>
                  <Typography variant="body2">{selected.description}</Typography>
                </Box>
                <Box>
                  <Chip
                    label={selected.runtimeStatus}
                    color={statusColor(selected.runtimeStatus)}
                  />
                </Box>
              </Box>
              <Box mt={2}>
                <Tabs value={tab} onChange={(_, value) => setTab(value)}
                  indicatorColor="primary" textColor="primary"
                  variant="scrollable">
                  <Tab icon={<DashboardIcon />} label="프로젝트" />
                  <Tab icon={<AccountTreeIcon />} label="설계" />
                  <Tab icon={<CodeIcon />} label="개발" />
                  <Tab icon={<StorageIcon />} label="운영" />
                </Tabs>
              </Box>
            </Paper>

            {tab === 0 && (
              <Paper className={classes.panel} elevation={0}>
                <Typography variant="h6">프로젝트 계약</Typography>
                <DetailRows items={[
                  ['소유 팀', selected.owner],
                  ['수명주기', selected.lifecycle],
                  ['호환성 등급', selected.compatibilityClass],
                  ['결합 상태', selected.integrationStatus],
                  ['Manifest', selected.metadataPath],
                ]} />
              </Paper>
            )}
            {tab === 1 && (
              <Paper className={classes.panel} elevation={0}>
                <Typography variant="h6">설계 제어</Typography>
                <Typography variant="body2">
                  Actor → Process → Step → State → Action → Screen → Contract
                </Typography>
                <Box mt={2} display="flex" flexWrap="wrap" style={{ gap: 8 }}>
                  <Button variant="contained" color="primary"
                    href={selected.screenSpaceRoute} startIcon={<LaunchIcon />}>
                    화면 공간 설계
                  </Button>
                  <Button href={selected.designRoute} startIcon={<LaunchIcon />}>
                    1,000개 설계 카탈로그
                  </Button>
                </Box>
                <DetailRows items={[
                  ['설계 기준', 'Actor·Process·Test·Task'],
                  ['데이터 계약', 'OpenAPI + JSON Schema'],
                  ['화면 계약', 'Layout·Section·Component·Binding·Event'],
                  ['승인 조건', '참조 무결성·권한·상태 전이·테스트 통과'],
                ]} />
              </Paper>
            )}
            {tab === 2 && (
              <Paper className={classes.panel} elevation={0}>
                <Typography variant="h6">분리 개발과 결합</Typography>
                <Box className={classes.pipeline} mt={2}>
                  {[
                    ['1', '독립 개발', selected.sourcePath],
                    ['2', '계약 검증', 'OpenAPI·Schema·Policy'],
                    ['3', '품질 게이트', 'Build·Test·Security'],
                    ['4', 'Runtime 등록', selected.integrationStatus],
                  ].map(([number, label, value]) => (
                    <Box className={classes.stage} key={number}>
                      <Typography variant="overline">{number}단계</Typography>
                      <Typography variant="subtitle2">{label}</Typography>
                      <Typography variant="caption">{value}</Typography>
                    </Box>
                  ))}
                </Box>
                <DetailRows items={[
                  ['소스 모듈', selected.sourcePath],
                  ['메타데이터', selected.metadataPath],
                  ['정적 자산', selected.assetPath],
                  ['결합 원칙', 'Core 직접 수정 금지·Adapter/Extension Point 사용'],
                ]} />
              </Paper>
            )}
            {tab === 3 && (
              <Paper className={classes.panel} elevation={0}>
                <Typography variant="h6">운영 바인딩</Typography>
                <DetailRows items={[
                  ['런타임 방식', selected.runtimeMode],
                  ['런타임 상태', selected.runtimeStatus],
                  ['접속 경로', selected.runtimeRoute],
                  ['DB 바인딩', selected.databaseMode],
                  ['DB 스키마', selected.databaseSchema],
                  ['데이터 격리 키', 'tenantId + projectId + designVersion'],
                ]} />
                {selected.runtimeRoute.startsWith('http') && (
                  <Button href={selected.runtimeRoute} target="_blank"
                    startIcon={<LaunchIcon />}>
                    실제 런타임 열기
                  </Button>
                )}
              </Paper>
            )}
          </Box>
        </Box>
      </Content>
    </Page>
  );
}
