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
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  Typography,
  makeStyles,
} from '@material-ui/core';
import LaunchIcon from '@material-ui/icons/Launch';
import SaveIcon from '@material-ui/icons/Save';
import PublishIcon from '@material-ui/icons/Publish';
import {
  ACTOR_PROCESS_TAB_COUNT,
  ACTOR_PROCESS_WORKSPACES,
  ActorProcessTab,
  ActorProcessWorkspaceId,
} from './actorProcessWorkspaces';
import { RESONANCE_PROJECT_REGISTRY } from './generatedProjectRegistry';

type ProjectOption = (typeof RESONANCE_PROJECT_REGISTRY)[number] & {
  status?: string;
  tasks?: ProjectTask[];
};
type ProjectTask = {
  taskId: string;
  taskType: string;
  status: string;
  errorMessage?: string;
};
type DesignRelease = {
  designVersion: number;
  status: string;
  contractSha256: string;
};
type OperationsSummary = {
  inventory?: {
    projectCount?: number;
    taskCount?: number;
    controlAssetCount?: number;
    designAssetCount?: number;
  };
  taskStatuses?: Record<string, number>;
};

const useStyles = makeStyles(theme => ({
  context: {
    padding: theme.spacing(2.5),
    borderRadius: 12,
    border: '1px solid #cbd5e1',
    marginBottom: theme.spacing(2),
  },
  workspace: {
    padding: theme.spacing(2),
    borderRadius: 10,
    border: '1px solid #dbe4ea',
    height: '100%',
    cursor: 'pointer',
  },
  active: {
    borderColor: '#005ea8',
    boxShadow: 'inset 4px 0 #005ea8',
    background: '#f0f7ff',
  },
  layout: {
    display: 'grid',
    gridTemplateColumns: 'minmax(250px,0.8fr) minmax(0,2.2fr)',
    gap: theme.spacing(2),
    [theme.breakpoints.down('sm')]: { gridTemplateColumns: '1fr' },
  },
  tab: {
    padding: theme.spacing(1.5),
    marginBottom: theme.spacing(1),
    border: '1px solid #dbe4ea',
    borderRadius: 8,
    cursor: 'pointer',
  },
  selectedTab: { borderColor: '#005ea8', background: '#f0f7ff' },
  detail: {
    padding: theme.spacing(3),
    borderRadius: 12,
    border: '1px solid #dbe4ea',
  },
  metric: {
    padding: theme.spacing(2),
    borderRadius: 8,
    border: '1px solid #e2e8f0',
    background: '#f8fafc',
  },
}));

const routeForWorkspace: Record<ActorProcessWorkspaceId, string> = {
  design: '/design-assets',
  develop: '/system-development',
  operate: '/system-operations',
};

export function ActorProcessControlPage(props: {
  initialWorkspaceId?: ActorProcessWorkspaceId;
}) {
  const classes = useStyles();
  const fetchApi = useApi(fetchApiRef);
  const query = new URLSearchParams(window.location.search);
  const requestedWorkspace = query.get(
    'workspace',
  ) as ActorProcessWorkspaceId | null;
  const initialWorkspace: ActorProcessWorkspaceId =
    props.initialWorkspaceId ??
    (requestedWorkspace &&
    ACTOR_PROCESS_WORKSPACES.some(item => item.id === requestedWorkspace)
      ? requestedWorkspace
      : 'design');
  const [projects, setProjects] = useState<ProjectOption[]>(
    RESONANCE_PROJECT_REGISTRY,
  );
  const [projectId, setProjectId] = useState(
    query.get('projectId') ??
      RESONANCE_PROJECT_REGISTRY[0]?.projectId ??
      'CCUS-PLATFORM',
  );
  const [designVersion, setDesignVersion] = useState(1);
  const [release, setRelease] = useState<DesignRelease | null>(null);
  const [summary, setSummary] = useState<OperationsSummary>({});
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [workspaceId, setWorkspaceId] =
    useState<ActorProcessWorkspaceId>(initialWorkspace);
  const [tabId, setTabId] = useState(
    query.get('tab') ??
      ACTOR_PROCESS_WORKSPACES.find(item => item.id === initialWorkspace)
        ?.tabs[0].id ??
      'actors',
  );
  const workspace =
    ACTOR_PROCESS_WORKSPACES.find(item => item.id === workspaceId) ??
    ACTOR_PROCESS_WORKSPACES[0];
  const selectedTab = useMemo<ActorProcessTab>(
    () => workspace.tabs.find(item => item.id === tabId) ?? workspace.tabs[0],
    [tabId, workspace],
  );
  const selectedProject =
    projects.find(item => item.projectId === projectId) ?? projects[0];
  const tasks = selectedProject?.tasks ?? [];
  const completedTasks = tasks.filter(task =>
    ['COMPLETED', 'VERIFIED', 'PROMOTED'].includes(task.status),
  ).length;
  const taskProgress =
    tasks.length === 0 ? 0 : Math.round((completedTasks / tasks.length) * 100);
  const developmentContractUrl = `/api/resonance-projects/${encodeURIComponent(
    projectId,
  )}/development-contract`;

  const loadReleases = async (targetProjectId: string) => {
    const response = await fetchApi.fetch(
      `/api/resonance-projects/${encodeURIComponent(
        targetProjectId,
      )}/design-releases`,
    );
    if (!response.ok) return;
    const payload = (await response.json()) as {
      releases?: DesignRelease[];
    };
    const latest = payload.releases?.[0] ?? null;
    setRelease(latest);
    if (latest) setDesignVersion(latest.designVersion);
  };

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const [projectResponse, summaryResponse] = await Promise.all([
        fetchApi.fetch('/api/resonance-projects'),
        fetchApi.fetch('/api/resonance-projects/operations/summary'),
      ]);
      if (projectResponse.ok) {
        const payload = (await projectResponse.json()) as {
          projects?: ProjectOption[];
        };
        const dynamic = payload.projects ?? [];
        setProjects([
          ...new Map(
            [...RESONANCE_PROJECT_REGISTRY, ...dynamic].map(project => [
              project.projectId,
              project,
            ]),
          ).values(),
        ] as ProjectOption[]);
      }
      if (summaryResponse.ok) {
        setSummary((await summaryResponse.json()) as OperationsSummary);
      }
      await loadReleases(projectId);
    } catch {
      setMessage(
        '제어 plane 데이터를 불러오지 못했습니다. 잠시 후 다시 시도하세요.',
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadDashboard();
    // projectId 변경 시 선택 프로젝트의 릴리스와 태스크를 다시 조회합니다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const saveDesignRelease = async () => {
    setMessage('설계 계약을 검증하고 저장하는 중입니다.');
    const contract = {
      schemaVersion: 2,
      projectId,
      tenantId: 'DEFAULT',
      designVersion,
      source: 'BACKSTAGE_ACTOR_PROCESS_CONTROL',
      sourceOfTruth: 'BACKSTAGE',
      contextFields: [
        'projectId',
        'tenantId',
        'designVersion',
        'actorCode',
        'processCode',
        'stepCode',
      ],
      workspaces: ACTOR_PROCESS_WORKSPACES,
      runtimeBinding: {
        designContract: developmentContractUrl,
        runtime: 'RESONANCE',
        generator:
          '/admin/api/system/actor-process/generation/compile-and-queue',
      },
    };
    const response = await fetchApi.fetch(
      `/api/resonance-projects/${encodeURIComponent(
        projectId,
      )}/design-releases`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ designVersion, contract }),
      },
    );
    const payload = (await response.json()) as {
      message?: string;
      validation?: { failures?: string[] };
    };
    if (!response.ok) {
      setMessage(
        payload.validation?.failures?.join(', ') ??
          payload.message ??
          '설계 저장에 실패했습니다.',
      );
      return;
    }
    setMessage('설계가 검증되어 Backstage에 저장되었습니다.');
    await loadReleases(projectId);
  };

  const promoteDesignRelease = async () => {
    setMessage('검증된 설계를 Resonance 개발 기준으로 승격하는 중입니다.');
    const response = await fetchApi.fetch(
      `/api/resonance-projects/${encodeURIComponent(
        projectId,
      )}/design-releases/${designVersion}/promote`,
      { method: 'POST' },
    );
    const payload = (await response.json()) as { message?: string };
    if (!response.ok) {
      setMessage(payload.message ?? '설계 승격에 실패했습니다.');
      return;
    }
    setMessage(
      '승격 완료: Resonance는 이 Backstage 개발 계약을 기준으로 생성·검증합니다.',
    );
    await loadDashboard();
  };

  const selectWorkspace = (id: ActorProcessWorkspaceId) => {
    const next = ACTOR_PROCESS_WORKSPACES.find(item => item.id === id)!;
    setWorkspaceId(id);
    setTabId(next.tabs[0].id);
    window.history.replaceState(
      null,
      '',
      `${
        window.location.pathname
      }?workspace=${id}&projectId=${encodeURIComponent(projectId)}`,
    );
  };

  return (
    <Page themeId="tool">
      <Header
        title="Actor·Process 프로젝트 제어"
        subtitle="Backstage를 설계·개발·운영의 단일 기준으로 사용하고 Resonance 실행 환경을 제어합니다."
      />
      <Content>
        {loading && <LinearProgress />}
        <Paper className={classes.context} elevation={0}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={4}>
              <FormControl variant="outlined" size="small" fullWidth>
                <InputLabel>프로젝트</InputLabel>
                <Select
                  value={projectId}
                  label="프로젝트"
                  onChange={event => {
                    setProjectId(String(event.target.value));
                    setMessage('');
                  }}
                >
                  {projects.map(project => (
                    <MenuItem key={project.projectId} value={project.projectId}>
                      {project.projectName} ({project.projectId})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={8}>
              <Typography variant="subtitle1">
                {selectedProject?.projectName ?? projectId}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                projectId={projectId} · tenantId=DEFAULT · designVersion=
                {designVersion}
              </Typography>
              <Box mt={1} display="flex" gridGap={8} flexWrap="wrap">
                <Chip
                  size="small"
                  label={`설계 릴리스 ${release?.status ?? '미등록'}`}
                  color={release?.status === 'PROMOTED' ? 'primary' : 'default'}
                />
                <Chip size="small" label={`개발 태스크 ${tasks.length}개`} />
                <Chip size="small" label={`완료율 ${taskProgress}%`} />
                {release?.contractSha256 && (
                  <Chip
                    size="small"
                    label={`SHA-256 ${release.contractSha256.slice(0, 12)}`}
                  />
                )}
              </Box>
            </Grid>
          </Grid>
          <Box mt={2} display="flex" gridGap={8} flexWrap="wrap">
            <Button
              variant="outlined"
              color="primary"
              startIcon={<SaveIcon />}
              onClick={saveDesignRelease}
            >
              설계 검증·저장
            </Button>
            <Button
              variant="contained"
              color="primary"
              startIcon={<PublishIcon />}
              disabled={release?.status !== 'VALIDATED'}
              onClick={promoteDesignRelease}
            >
              Resonance 개발 기준으로 승격
            </Button>
            <Button
              variant="outlined"
              href={`${developmentContractUrl}?mode=preview`}
              target="_blank"
              rel="noreferrer"
            >
              개발 계약 JSON
            </Button>
          </Box>
          {message && (
            <Typography variant="body2" style={{ marginTop: 12 }}>
              {message}
            </Typography>
          )}
        </Paper>

        <Grid container spacing={2}>
          {ACTOR_PROCESS_WORKSPACES.map(item => (
            <Grid item xs={12} md={4} key={item.id}>
              <Paper
                className={`${classes.workspace} ${
                  item.id === workspace.id ? classes.active : ''
                }`}
                elevation={0}
                role="button"
                tabIndex={0}
                onClick={() => selectWorkspace(item.id)}
              >
                <Typography variant="overline">
                  {item.tabs.length}개 기능
                </Typography>
                <Typography variant="h6">{item.label}</Typography>
                <Typography variant="body2">{item.description}</Typography>
              </Paper>
            </Grid>
          ))}
        </Grid>

        <Box className={classes.layout} mt={2}>
          <Paper className={classes.detail} elevation={0}>
            <Typography variant="overline">
              전체 {ACTOR_PROCESS_TAB_COUNT}개 제어 기능
            </Typography>
            <Typography variant="h6">{workspace.label}</Typography>
            <Box mt={2}>
              {workspace.tabs.map(item => (
                <Box
                  key={item.id}
                  className={`${classes.tab} ${
                    item.id === selectedTab.id ? classes.selectedTab : ''
                  }`}
                  role="button"
                  tabIndex={0}
                  onClick={() => setTabId(item.id)}
                >
                  <Typography variant="subtitle2">{item.label}</Typography>
                  <Typography variant="caption">{item.capability}</Typography>
                </Box>
              ))}
            </Box>
          </Paper>

          <Paper className={classes.detail} elevation={0}>
            <Box display="flex" justifyContent="space-between" flexWrap="wrap">
              <Box>
                <Typography variant="overline">{workspace.label}</Typography>
                <Typography variant="h5">{selectedTab.label}</Typography>
              </Box>
              <Chip label={projectId} color="primary" />
            </Box>
            <Typography variant="body1" style={{ marginTop: 16 }}>
              {selectedTab.description}
            </Typography>
            <Grid container spacing={2} style={{ marginTop: 8 }}>
              <Grid item xs={12} sm={6} md={3}>
                <Box className={classes.metric}>
                  <Typography variant="caption">프로젝트</Typography>
                  <Typography variant="h6">
                    {summary.inventory?.projectCount ?? projects.length}
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Box className={classes.metric}>
                  <Typography variant="caption">개발 태스크</Typography>
                  <Typography variant="h6">
                    {summary.inventory?.taskCount ?? tasks.length}
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Box className={classes.metric}>
                  <Typography variant="caption">제어 자산</Typography>
                  <Typography variant="h6">
                    {summary.inventory?.controlAssetCount ?? 0}
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Box className={classes.metric}>
                  <Typography variant="caption">디자인 자산</Typography>
                  <Typography variant="h6">
                    {summary.inventory?.designAssetCount ?? 0}
                  </Typography>
                </Box>
              </Grid>
            </Grid>
            <Box mt={3}>
              <Typography variant="subtitle2">실행 기준</Typography>
              <Typography variant="body2">
                설계는 Backstage에서 버전·검증·승인하고, 개발 태스크는 승격된
                계약만 사용합니다. 실제 고객 업무 데이터와 상태 전이는
                Resonance에서 처리하며 결과 증적을 다시 Backstage에 기록합니다.
              </Typography>
            </Box>
            <Box mt={3} display="flex" gridGap={8} flexWrap="wrap">
              <Button
                variant="contained"
                color="primary"
                href={routeForWorkspace[workspace.id]}
                startIcon={<LaunchIcon />}
              >
                {workspace.label} 작업공간 열기
              </Button>
              {workspace.id === 'operate' && (
                <Button
                  variant="outlined"
                  href={`http://172.16.1.232/admin/system/actor-process?projectId=${encodeURIComponent(
                    projectId,
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Resonance 실제 업무 실행
                </Button>
              )}
            </Box>
          </Paper>
        </Box>
      </Content>
    </Page>
  );
}
