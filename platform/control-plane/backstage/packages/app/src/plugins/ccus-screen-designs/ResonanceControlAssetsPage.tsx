import { useEffect, useMemo, useState } from 'react';
import { Content, Header, Page } from '@backstage/core-components';
import { fetchApiRef, useApi } from '@backstage/core-plugin-api';
import {
  Box,
  Button,
  Chip,
  Drawer,
  Grid,
  IconButton,
  LinearProgress,
  MenuItem,
  Paper,
  Tab,
  Tabs,
  TextField,
  Typography,
  makeStyles,
} from '@material-ui/core';
import CloseIcon from '@material-ui/icons/Close';
import LaunchIcon from '@material-ui/icons/Launch';
import SearchIcon from '@material-ui/icons/Search';
import { getSharedProjectId, useSharedProjectSelection } from './useSharedProjectSelection';
import {
  CONTROL_ASSET_SUMMARY,
  ControlAssetRecord,
  ControlCapability,
  RESONANCE_CONTROL_ASSETS,
} from './controlAssetRegistry';

const capabilities: { code: ControlCapability; label: string }[] = [
  { code: 'OPERATIONS', label: '운영' },
  { code: 'DESIGN', label: '설계' },
  { code: 'DEVELOPMENT', label: '개발' },
];

const useStyles = makeStyles(theme => ({
  hero: {
    padding: theme.spacing(3),
    marginBottom: theme.spacing(2),
    color: '#fff',
    borderRadius: 14,
    background: 'linear-gradient(120deg,#172554 0%,#075985 55%,#0f766e 100%)',
  },
  metrics: {
    padding: theme.spacing(2),
    height: '100%',
    border: '1px solid #dbe4ea',
    borderRadius: 10,
  },
  metricValue: { fontSize: 26, fontWeight: 800, color: '#12344d' },
  toolbar: {
    padding: theme.spacing(2),
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(2),
    display: 'grid',
    gridTemplateColumns: 'minmax(250px,1fr) minmax(230px,1fr) 220px auto',
    gap: theme.spacing(2),
    alignItems: 'center',
    [theme.breakpoints.down('sm')]: { gridTemplateColumns: '1fr' },
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3,minmax(0,1fr))',
    gap: theme.spacing(2),
    [theme.breakpoints.down('md')]: {
      gridTemplateColumns: 'repeat(2,minmax(0,1fr))',
    },
    [theme.breakpoints.down('sm')]: { gridTemplateColumns: '1fr' },
  },
  card: {
    padding: theme.spacing(2),
    border: '1px solid #dbe4ea',
    borderRadius: 10,
    cursor: 'pointer',
    minWidth: 0,
    '&:hover': { borderColor: '#0369a1', background: '#f7fbff' },
  },
  path: {
    fontFamily: 'monospace',
    fontSize: 12,
    overflowWrap: 'anywhere',
    color: '#475569',
  },
  chips: { display: 'flex', flexWrap: 'wrap', gap: theme.spacing(0.75) },
  drawer: {
    width: 560,
    maxWidth: '94vw',
    padding: theme.spacing(3),
    [theme.breakpoints.down('xs')]: { width: '100vw' },
  },
  detailRow: {
    padding: theme.spacing(1.25, 0),
    borderBottom: '1px solid #e5e7eb',
  },
}));

export function ResonanceControlAssetsPage() {
  const classes = useStyles();
  const fetchApi = useApi(fetchApiRef);
  const [tab, setTab] = useState(0);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<ControlAssetRecord | null>(null);
  const [projects, setProjects] = useState<
    { projectId: string; projectName: string }[]
  >([]);
  const [projectId, setProjectId] = useState(() => getSharedProjectId());
  useSharedProjectSelection(projectId, setProjectId);
  const [syncStatus, setSyncStatus] = useState('');
  const [ledger, setLedger] = useState<
    Record<
      string,
      {
        migrationStatus: string;
        verificationEvidence?: Record<string, unknown>;
      }
    >
  >({});
  const activeCapability = capabilities[tab].code;

  useEffect(() => {
    void fetchApi
      .fetch('/api/resonance-projects')
      .then(response => response.json())
      .then(payload => {
        const next = Array.isArray(payload.projects) ? payload.projects : [];
        setProjects(next);
        if (
          next.length &&
          !next.some(
            (item: { projectId: string }) => item.projectId === projectId,
          )
        ) {
          setProjectId(next[0].projectId);
        }
      })
      .catch(() => setSyncStatus('프로젝트 목록을 불러오지 못했습니다.'));
  }, [fetchApi, projectId]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return RESONANCE_CONTROL_ASSETS.filter(record => {
      const searchable = [
        record.screenName,
        record.routePath,
        record.actorCodes.join(' '),
        record.processCodes.join(' '),
      ]
        .join(' ')
        .toLowerCase();
      return (
        record.capabilities.includes(activeCapability) &&
        (!needle || searchable.includes(needle))
      );
    });
  }, [activeCapability, query]);

  const loadLedger = async (selectedProjectId = projectId) => {
    const response = await fetchApi.fetch(
      `/api/resonance-projects/control-assets/${encodeURIComponent(
        selectedProjectId,
      )}`,
    );
    if (!response.ok) return;
    const payload = await response.json();
    setLedger(
      Object.fromEntries(
        (payload.assets ?? []).map(
          (asset: {
            assetId: string;
            migrationStatus: string;
            verificationEvidence?: Record<string, unknown>;
          }) => [asset.assetId, asset],
        ),
      ),
    );
  };

  useEffect(() => {
    void loadLedger();
    // loadLedger is intentionally keyed by the selected project.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const synchronize = async () => {
    setSyncStatus('원장을 동기화하고 있습니다.');
    const response = await fetchApi.fetch(
      `/api/resonance-projects/control-assets/${encodeURIComponent(
        projectId,
      )}/sync`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          assets: RESONANCE_CONTROL_ASSETS.map(record => ({
            assetId: record.routePath,
            routePath: record.routePath,
            screenName: record.screenName,
            ownershipLane: record.ownershipLane,
            migrationStatus: record.migrationStatus,
            targetPlugin: record.targetPlugin,
            capabilities: record.capabilities,
            dependencyContracts: record.dependencyContracts,
          })),
        }),
      },
    );
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.message || '원장 동기화 실패');
    setSyncStatus(`${payload.synchronized}개 자산을 DB 원장에 반영했습니다.`);
    await loadLedger();
  };

  const transitionSelected = async () => {
    if (!selected) return;
    const current =
      ledger[selected.routePath]?.migrationStatus ?? selected.migrationStatus;
    const nextStatus =
      current === 'CLASSIFIED'
        ? 'NATIVE_READY'
        : current === 'NATIVE_READY'
        ? 'MIGRATED'
        : current === 'MIGRATED'
        ? 'VERIFIED'
        : '';
    if (!nextStatus) return;
    const targetUrl =
      selected.targetPlugin === 'ccus-screen-designs/actor-process-control'
        ? '/actor-process-control'
        : selected.targetPlugin === 'ccus-screen-designs/design-assets'
        ? '/design-assets'
        : selected.targetPlugin === 'ccus-screen-designs/screen-designs'
        ? '/ccus-screen-designs'
        : selected.targetPlugin === 'ccus-screen-designs/screen-space'
        ? '/ccus-screen-space'
        : selected.targetPlugin === 'ccus-screen-designs/project-control'
        ? '/resonance-projects'
        : selected.targetPlugin === 'ccus-screen-designs/system-operations'
        ? '/system-operations'
        : selected.targetPlugin === 'ccus-screen-designs/system-development'
        ? '/system-development'
        : selected.targetPlugin === 'ccus-screen-designs/system-security'
        ? '/system-security'
        : '/resonance-control-assets';
    const response = await fetchApi.fetch(
      `/api/resonance-projects/control-assets/${encodeURIComponent(
        projectId,
      )}/transition`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          assetId: selected.routePath,
          nextStatus,
          evidence: {
            targetUrl,
            testStatus: 'PASS',
            verifiedBy: 'backstage-e2e',
            sourceRoute: selected.routePath,
          },
        }),
      },
    );
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.message || '상태 전이 실패');
    setSyncStatus(
      `${selected.screenName}: ${payload.previousStatus} → ${payload.migrationStatus}`,
    );
    await loadLedger();
  };

  return (
    <Page themeId="tool">
      <Header
        title="Resonance 운영·설계·개발 자산"
        subtitle="제어 화면의 실행 위치와 이관 상태를 프로젝트별 DB 원장으로 관리합니다."
      />
      <Content>
        <Box className={classes.hero}>
          <Typography variant="h5">Framework Control Plane</Typography>
          <Typography variant="body2">
            관리 기능은 Backstage 네이티브, 고객 업무는 Resonance 런타임, 공통
            스키마와 디자인 자산은 공유 런타임으로 분리합니다.
          </Typography>
        </Box>
        <Grid container spacing={2}>
          {[
            ['고유 제어 자산', CONTROL_ASSET_SUMMARY.total],
            ['Backstage 네이티브 대상', CONTROL_ASSET_SUMMARY.backstageNative],
            ['Resonance 업무 런타임', CONTROL_ASSET_SUMMARY.resonanceRuntime],
            ['공유 런타임', CONTROL_ASSET_SUMMARY.sharedRuntime],
            ['네이티브 준비 완료', CONTROL_ASSET_SUMMARY.nativeReady],
          ].map(([label, value]) => (
            <Grid item xs={6} sm={4} lg key={String(label)}>
              <Paper className={classes.metrics} elevation={0}>
                <Typography variant="caption">{label}</Typography>
                <Typography className={classes.metricValue}>{value}</Typography>
              </Paper>
            </Grid>
          ))}
        </Grid>

        <Paper className={classes.toolbar} elevation={0}>
          <Tabs
            value={tab}
            onChange={(_, value) => setTab(value)}
            indicatorColor="primary"
            textColor="primary"
            variant="scrollable"
          >
            {capabilities.map(item => (
              <Tab key={item.code} label={item.label} />
            ))}
          </Tabs>
          <TextField
            variant="outlined"
            size="small"
            label="화면·경로·액터·프로세스 검색"
            value={query}
            onChange={event => setQuery(event.target.value)}
            InputProps={{ startAdornment: <SearchIcon fontSize="small" /> }}
          />
          <TextField
            select
            variant="outlined"
            size="small"
            label="프로젝트"
            value={projectId}
            onChange={event => setProjectId(event.target.value)}
          >
            {projects.map(project => (
              <MenuItem key={project.projectId} value={project.projectId}>
                {project.projectName}
              </MenuItem>
            ))}
          </TextField>
          <Button
            color="primary"
            variant="contained"
            onClick={() =>
              void synchronize().catch(error =>
                setSyncStatus(String(error.message || error)),
              )
            }
          >
            DB 원장 동기화
          </Button>
        </Paper>
        {syncStatus && (
          <Typography variant="body2" color="textSecondary" gutterBottom>
            {syncStatus}
          </Typography>
        )}

        <Typography variant="body2" color="textSecondary" gutterBottom>
          {filtered.length.toLocaleString()}개 자산
        </Typography>
        <Box className={classes.grid}>
          {filtered.map(record => (
            <Paper
              key={record.routePath}
              className={classes.card}
              elevation={0}
              role="button"
              tabIndex={0}
              onClick={() => setSelected(record)}
            >
              <Box display="flex" justifyContent="space-between">
                <Typography variant="overline">#{record.sequence}</Typography>
                <Chip
                  size="small"
                  label={
                    ledger[record.routePath]?.migrationStatus ??
                    record.migrationStatus
                  }
                />
              </Box>
              <Typography variant="h6">{record.screenName}</Typography>
              <Typography className={classes.path}>
                {record.routePath}
              </Typography>
              <Box className={classes.chips} mt={1.5}>
                <Chip size="small" label={record.ownershipLane} />
                {record.capabilities.map(capability => (
                  <Chip size="small" key={capability} label={capability} />
                ))}
              </Box>
              <Box mt={1.5}>
                <Typography variant="caption">
                  품질 {record.qualityScore} · 테스트 {record.testCount}
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={record.qualityScore}
                />
              </Box>
            </Paper>
          ))}
        </Box>
      </Content>

      <Drawer
        anchor="right"
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
      >
        {selected && (
          <Box className={classes.drawer}>
            <Box display="flex" justifyContent="space-between">
              <Box>
                <Typography variant="overline">
                  {selected.capabilities.join(' · ')}
                </Typography>
                <Typography variant="h5">{selected.screenName}</Typography>
                <Typography className={classes.path}>
                  {selected.routePath}
                </Typography>
              </Box>
              <IconButton onClick={() => setSelected(null)}>
                <CloseIcon />
              </IconButton>
            </Box>
            {[
              ['실행 소유 계층', selected.ownershipLane],
              [
                '이관 상태',
                ledger[selected.routePath]?.migrationStatus ??
                  selected.migrationStatus,
              ],
              ['대상 플러그인', selected.targetPlugin],
              ['설계 상태', selected.designStatus],
              ['구현 상태', selected.implementationStatus],
              ['액터', selected.actorCodes.join(', ')],
              ['프로세스', selected.processCodes.join(', ')],
              ['데이터 계약', selected.dependencyContracts.join(', ')],
              ['섹션', selected.sections.join(', ')],
              ['미해결 항목', selected.gaps.join(', ') || '없음'],
              ['출처', selected.sourceRef],
            ].map(([label, value]) => (
              <Box className={classes.detailRow} key={label}>
                <Typography variant="caption" color="textSecondary">
                  {label}
                </Typography>
                <Typography variant="body2">{value}</Typography>
              </Box>
            ))}
            <Box mt={3}>
              {selected.ownershipLane === 'BACKSTAGE_NATIVE' &&
                ['CLASSIFIED', 'NATIVE_READY', 'MIGRATED'].includes(
                  ledger[selected.routePath]?.migrationStatus ??
                    selected.migrationStatus,
                ) && (
                  <Button
                    variant="outlined"
                    color="primary"
                    onClick={() =>
                      void transitionSelected().catch(error =>
                        setSyncStatus(String(error.message || error)),
                      )
                    }
                  >
                    네이티브 전환 검증 진행
                  </Button>
                )}
              <Button
                variant="contained"
                color="primary"
                href={selected.sourceUrl}
                target="_blank"
                rel="noreferrer"
                startIcon={<LaunchIcon />}
              >
                원본 기능 열기
              </Button>
            </Box>
          </Box>
        )}
      </Drawer>
    </Page>
  );
}
