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
import LaunchIcon from '@material-ui/icons/Launch';
import SaveIcon from '@material-ui/icons/Save';
import PublishIcon from '@material-ui/icons/Publish';
import {
  ACTOR_PROCESS_TAB_COUNT,
  ACTOR_PROCESS_WORKSPACES,
  ActorProcessTab,
} from './actorProcessWorkspaces';
import { RESONANCE_PROJECT_REGISTRY } from './generatedProjectRegistry';

type ProjectOption = (typeof RESONANCE_PROJECT_REGISTRY)[number];
type DesignRelease = {
  designVersion: number;
  status: string;
  contractSha256: string;
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
    borderColor: '#0369a1',
    boxShadow: 'inset 4px 0 #0369a1',
    background: '#f0f9ff',
  },
  layout: {
    display: 'grid',
    gridTemplateColumns: 'minmax(260px,0.85fr) minmax(0,2.15fr)',
    gap: theme.spacing(2),
    [theme.breakpoints.down('sm')]: { gridTemplateColumns: '1fr' },
  },
  tab: {
    padding: theme.spacing(2),
    marginBottom: theme.spacing(1),
    border: '1px solid #dbe4ea',
    borderRadius: 10,
    cursor: 'pointer',
  },
  selectedTab: { borderColor: '#2563eb', background: '#eff6ff' },
  detail: {
    padding: theme.spacing(3),
    borderRadius: 12,
    border: '1px solid #dbe4ea',
  },
}));

export function ActorProcessControlPage() {
  const classes = useStyles();
  const fetchApi = useApi(fetchApiRef);
  const [projects, setProjects] = useState<ProjectOption[]>(
    RESONANCE_PROJECT_REGISTRY,
  );
  const [projectId, setProjectId] = useState(
    RESONANCE_PROJECT_REGISTRY[0]?.projectId ?? 'CCUS-PLATFORM',
  );
  const [designVersion, setDesignVersion] = useState(1);
  const [release, setRelease] = useState<DesignRelease | null>(null);
  const [message, setMessage] = useState('');
  const [workspaceId, setWorkspaceId] = useState('operate');
  const [tabId, setTabId] = useState('work-dashboard');
  const workspace =
    ACTOR_PROCESS_WORKSPACES.find(item => item.id === workspaceId) ??
    ACTOR_PROCESS_WORKSPACES[0];
  const selectedTab = useMemo<ActorProcessTab>(
    () =>
      workspace.tabs.find(item => item.id === tabId) ?? workspace.tabs[0],
    [tabId, workspace],
  );
  const selectedProject =
    projects.find(item => item.projectId === projectId) ?? projects[0];
  const sourceUrl = `http://172.16.1.232/admin/system/actor-process?projectId=${encodeURIComponent(
    projectId,
  )}&tenantId=DEFAULT&designVersion=${designVersion}&tab=${encodeURIComponent(
    selectedTab.id,
  )}`;
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

  useEffect(() => {
    void fetchApi
      .fetch('/api/resonance-projects')
      .then(response => (response.ok ? response.json() : Promise.reject(response)))
      .then(
        (payload: {
          projects?: {
            projectId: string;
            projectName: string;
            designVersion?: number;
          }[];
        }) => {
          const dynamic = (payload.projects ?? []).map(project => ({
            ...RESONANCE_PROJECT_REGISTRY[0],
            projectId: project.projectId,
            projectName: project.projectName,
          }));
          setProjects([
            ...new Map(
              [...RESONANCE_PROJECT_REGISTRY, ...dynamic].map(project => [
                project.projectId,
                project,
              ]),
            ).values(),
          ]);
          const current = payload.projects?.find(
            project => project.projectId === projectId,
          );
          if (current?.designVersion) setDesignVersion(current.designVersion);
        },
      )
      .catch(() => {
        // 정적 레지스트리는 동적 API 장애 시에도 탐색을 가능하게 합니다.
      });
    void loadReleases(projectId);
  }, [fetchApi, projectId]);

  const saveDesignRelease = async () => {
    setMessage('설계 계약을 검증하고 저장하는 중입니다.');
    const contract = {
      schemaVersion: 1,
      projectId,
      tenantId: 'DEFAULT',
      designVersion,
      source: 'BACKSTAGE_ACTOR_PROCESS_CONTROL',
      contextFields: ['projectId', 'tenantId', 'designVersion'],
      workspaces: ACTOR_PROCESS_WORKSPACES,
      runtimeBinding: {
        route: '/admin/system/actor-process',
        api: '/admin/api/system/actor-process',
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
    setMessage('설계 계약이 검증되어 Backstage 원장에 저장되었습니다.');
    await loadReleases(projectId);
  };

  const promoteDesignRelease = async () => {
    setMessage('검증된 설계를 개발 기준으로 승격하는 중입니다.');
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
    setMessage('승격 완료: Resonance 생성기가 이 계약을 사용할 수 있습니다.');
    await loadReleases(projectId);
  };

  return (
    <Page themeId="tool">
      <Header
        title="Actor·Process 프로젝트 제어"
        subtitle="프로젝트 문맥을 유지하며 업무 운영·설계·검증·개발·배포 기능을 관리합니다."
      />
      <Content>
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
                  label={`설계 릴리스: ${release?.status ?? '미등록'}`}
                  color={release?.status === 'PROMOTED' ? 'primary' : 'default'}
                />
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
              Backstage 설계 원장 저장
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
              href={developmentContractUrl}
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
            <Grid item xs={12} sm={6} lg={3} key={item.id}>
              <Paper
                className={`${classes.workspace} ${
                  item.id === workspace.id ? classes.active : ''
                }`}
                elevation={0}
                role="button"
                tabIndex={0}
                onClick={() => {
                  setWorkspaceId(item.id);
                  setTabId(item.tabs[0].id);
                }}
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
              전체 {ACTOR_PROCESS_TAB_COUNT}개 기능
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
                  <Typography variant="caption">{item.id}</Typography>
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
            <Box mt={3}>
              <Typography variant="subtitle2">실행 문맥</Typography>
              <Typography variant="body2">
                Backstage의 승격된 설계 계약을 기준으로 프로젝트·테넌트·설계
                버전을 유지합니다. 실제 업무 데이터와 상태 전이는 Resonance
                API와 PostgreSQL에서 처리합니다.
              </Typography>
            </Box>
            <Box mt={3}>
              <Button
                variant="contained"
                color="primary"
                href={sourceUrl}
                target="_blank"
                rel="noreferrer"
                startIcon={<LaunchIcon />}
              >
                선택 기능 실행
              </Button>
            </Box>
          </Paper>
        </Box>
      </Content>
    </Page>
  );
}
