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
import {
  ACTOR_PROCESS_TAB_COUNT,
  ACTOR_PROCESS_WORKSPACES,
  ActorProcessTab,
} from './actorProcessWorkspaces';
import { RESONANCE_PROJECT_REGISTRY } from './generatedProjectRegistry';

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
  const [projects, setProjects] = useState(RESONANCE_PROJECT_REGISTRY);
  const [projectId, setProjectId] = useState(
    RESONANCE_PROJECT_REGISTRY[0]?.projectId ?? 'CCUS-PLATFORM',
  );
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
  )}&tenantId=DEFAULT&designVersion=1&tab=${encodeURIComponent(selectedTab.id)}`;

  useEffect(() => {
    void fetchApi
      .fetch('/api/resonance-projects')
      .then(response => (response.ok ? response.json() : Promise.reject(response)))
      .then((payload: { projects?: { projectId: string; projectName: string }[] }) => {
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
      })
      .catch(() => {
        // Static registry remains available when the dynamic API is unavailable.
      });
  }, [fetchApi]);

  return (
    <Page themeId="tool">
      <Header
        title="Actor·Process 프로젝트 제어"
        subtitle="프로젝트 문맥을 유지하며 업무 운영·설계·검증·개발·배포 기능을 실행합니다."
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
                  onChange={event => setProjectId(String(event.target.value))}
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
                projectId={projectId} · tenantId=DEFAULT · designVersion=1
              </Typography>
            </Grid>
          </Grid>
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
              전체 {ACTOR_PROCESS_TAB_COUNT}개 탭
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
                프로젝트, 테넌트, 설계 버전을 유지한 상태로 기존 기능을
                실행합니다. 네이티브 전환이 완료될 때까지 데이터 정본은
                Carbonet API와 PostgreSQL입니다.
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
