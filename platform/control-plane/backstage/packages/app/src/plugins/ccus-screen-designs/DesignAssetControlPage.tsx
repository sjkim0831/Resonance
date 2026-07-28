import { useCallback, useEffect, useMemo, useState } from 'react';
import { Content, Header, Page } from '@backstage/core-components';
import { fetchApiRef, useApi } from '@backstage/core-plugin-api';
import {
  Box,
  Button,
  Chip,
  Drawer,
  Grid,
  IconButton,
  MenuItem,
  Paper,
  Tab,
  Tabs,
  TextField,
  Typography,
  makeStyles,
} from '@material-ui/core';
import CloseIcon from '@material-ui/icons/Close';
import SearchIcon from '@material-ui/icons/Search';

type AssetType = 'THEME' | 'CSS' | 'SECTION' | 'COMPONENT' | 'SCREEN' | 'MENU';
type DesignAsset = {
  assetType: AssetType;
  assetId: string;
  assetName: string;
  routePath: string;
  version: string;
  active: boolean;
  payload: Record<string, unknown>;
  fingerprint: string;
  syncedAt: string;
};
type DesignDraft = {
  draftId: string;
  assetType: AssetType;
  assetId: string;
  baseFingerprint: string;
  patch: Record<string, unknown>;
  status: string;
  validationReport?: Record<string, unknown>;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  promotedAt?: string;
};

const types: { code: AssetType; label: string }[] = [
  { code: 'THEME', label: '테마' },
  { code: 'CSS', label: 'CSS' },
  { code: 'SECTION', label: '섹션' },
  { code: 'COMPONENT', label: '컴포넌트' },
  { code: 'SCREEN', label: '화면' },
  { code: 'MENU', label: '메뉴' },
];

const useStyles = makeStyles(theme => ({
  hero: {
    padding: theme.spacing(3),
    marginBottom: theme.spacing(2),
    color: '#fff',
    borderRadius: 14,
    background: 'linear-gradient(120deg,#172554,#075985 58%,#0f766e)',
  },
  toolbar: {
    display: 'grid',
    gridTemplateColumns: 'minmax(300px,1fr) 240px 320px',
    gap: theme.spacing(2),
    alignItems: 'center',
    padding: theme.spacing(2),
    marginBottom: theme.spacing(2),
    [theme.breakpoints.down('sm')]: { gridTemplateColumns: '1fr' },
  },
  metric: {
    padding: theme.spacing(2),
    border: '1px solid #dbe4ea',
    borderRadius: 10,
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
  mono: {
    fontFamily: 'monospace',
    fontSize: 12,
    overflowWrap: 'anywhere',
  },
  drawer: {
    width: 620,
    maxWidth: '96vw',
    padding: theme.spacing(3),
    [theme.breakpoints.down('xs')]: { width: '100vw' },
  },
}));

export function DesignAssetControlPage() {
  const classes = useStyles();
  const fetchApi = useApi(fetchApiRef);
  const [tab, setTab] = useState(0);
  const [query, setQuery] = useState('');
  const [projectId, setProjectId] = useState('CCUS-PLATFORM');
  const [projects, setProjects] = useState<
    { projectId: string; projectName: string }[]
  >([]);
  const [assets, setAssets] = useState<DesignAsset[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [selected, setSelected] = useState<DesignAsset | null>(null);
  const [error, setError] = useState('');
  const [draftName, setDraftName] = useState('');
  const [draftPayload, setDraftPayload] = useState('');
  const [draftId, setDraftId] = useState('');
  const [draftStatus, setDraftStatus] = useState('');
  const [drafts, setDrafts] = useState<DesignDraft[]>([]);
  const activeType = types[tab].code;

  const load = useCallback(async () => {
    const [assetResponse, draftResponse] = await Promise.all([
      fetchApi.fetch(
        `/api/resonance-projects/design-assets/${encodeURIComponent(
          projectId,
        )}?assetType=${activeType}&limit=500`,
      ),
      fetchApi.fetch(
        `/api/resonance-projects/design-assets/${encodeURIComponent(
          projectId,
        )}/drafts`,
      ),
    ]);
    const [assetPayload, draftPayloadResult] = await Promise.all([
      assetResponse.json(),
      draftResponse.json(),
    ]);
    if (!assetResponse.ok) {
      throw new Error(assetPayload.message || '자산 조회 실패');
    }
    if (!draftResponse.ok) {
      throw new Error(draftPayloadResult.message || '변경 이력 조회 실패');
    }
    setAssets(assetPayload.assets ?? []);
    setCounts(assetPayload.counts ?? {});
    setDrafts(draftPayloadResult.drafts ?? []);
  }, [activeType, fetchApi, projectId]);

  useEffect(() => {
    void fetchApi
      .fetch('/api/resonance-projects')
      .then(response => response.json())
      .then(payload => setProjects(payload.projects ?? []))
      .catch(reason => setError(String(reason)));
  }, [fetchApi]);

  useEffect(() => {
    void load()
      .then(() => setError(''))
      .catch(reason => setError(String(reason.message || reason)));
  }, [load]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return assets;
    return assets.filter(asset =>
      [asset.assetId, asset.assetName, asset.routePath]
        .join(' ')
        .toLowerCase()
        .includes(needle),
    );
  }, [assets, query]);

  const openAsset = (asset: DesignAsset) => {
    setSelected(asset);
    setDraftName(asset.assetName);
    setDraftPayload(JSON.stringify(asset.payload, null, 2));
    setDraftId('');
    setDraftStatus('');
  };

  const saveAndValidateDraft = async () => {
    if (!selected) return;
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(draftPayload);
    } catch {
      throw new Error('원본 계약 JSON 형식이 올바르지 않습니다.');
    }
    const createResponse = await fetchApi.fetch(
      `/api/resonance-projects/design-assets/${encodeURIComponent(
        projectId,
      )}/drafts`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          assetType: selected.assetType,
          assetId: selected.assetId,
          baseFingerprint: selected.fingerprint,
          createdBy: 'backstage-user',
          patch: {
            assetName: draftName,
            routePath: selected.routePath,
            version: selected.version,
            active: selected.active,
            payload,
          },
        }),
      },
    );
    const created = await createResponse.json();
    if (!createResponse.ok) {
      throw new Error(created.message || '초안 저장 실패');
    }
    const validateResponse = await fetchApi.fetch(
      `/api/resonance-projects/design-assets/${encodeURIComponent(
        projectId,
      )}/drafts/${created.draftId}/validate`,
      { method: 'POST' },
    );
    const validated = await validateResponse.json();
    if (!validateResponse.ok) {
      throw new Error(
        validated.failures?.join(', ') || validated.message || '검증 실패',
      );
    }
    setDraftId(created.draftId);
    setDraftStatus('VALIDATED');
  };

  const promoteDraft = async () => {
    if (!draftId) return;
    const response = await fetchApi.fetch(
      `/api/resonance-projects/design-assets/${encodeURIComponent(
        projectId,
      )}/drafts/${draftId}/promote`,
      { method: 'POST' },
    );
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.message || '승격 실패');
    setDraftStatus(`PROMOTED · TASK ${payload.taskId}`);
    await load();
  };

  const requestRollback = async (target: DesignDraft) => {
    const response = await fetchApi.fetch(
      `/api/resonance-projects/design-assets/${encodeURIComponent(
        projectId,
      )}/drafts/${target.draftId}/rollback`,
      { method: 'POST' },
    );
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.message || '롤백 요청 실패');
    }
    setDraftStatus(`ROLLBACK_QUEUED · TASK ${payload.taskId}`);
    await load();
  };

  return (
    <Page themeId="tool">
      <Header
        title="공통 디자인 자산 관리"
        subtitle="테마·CSS·섹션·컴포넌트·화면·메뉴를 프로젝트별 단일 원장에서 관리합니다."
      />
      <Content>
        <Box className={classes.hero}>
          <Typography variant="h5">Common Design Asset Registry</Typography>
          <Typography variant="body2">
            Resonance 실행 DB의 검증된 자산을 읽기 전용 스냅샷으로 동기화하며,
            설계 승인 후에만 생성 계약으로 승격합니다.
          </Typography>
        </Box>
        <Grid container spacing={2}>
          {types.map(type => (
            <Grid item xs={6} sm={4} lg={2} key={type.code}>
              <Paper className={classes.metric} elevation={0}>
                <Typography variant="caption">{type.label}</Typography>
                <Typography variant="h5">
                  {Number(counts[type.code] ?? 0).toLocaleString()}
                </Typography>
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
            {types.map(type => (
              <Tab key={type.code} label={type.label} />
            ))}
          </Tabs>
          <TextField
            select
            size="small"
            variant="outlined"
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
          <TextField
            size="small"
            variant="outlined"
            label="ID·이름·경로 검색"
            value={query}
            onChange={event => setQuery(event.target.value)}
            InputProps={{ startAdornment: <SearchIcon fontSize="small" /> }}
          />
        </Paper>
        {error && (
          <Typography color="error" gutterBottom>
            {error}
          </Typography>
        )}
        <Typography variant="body2" color="textSecondary" gutterBottom>
          {visible.length.toLocaleString()}개 {types[tab].label} 자산
        </Typography>
        <Box className={classes.grid}>
          {visible.map(asset => (
            <Paper
              className={classes.card}
              elevation={0}
              key={`${asset.assetType}:${asset.assetId}`}
              onClick={() => openAsset(asset)}
            >
              <Box display="flex" justifyContent="space-between">
                <Chip size="small" label={asset.assetType} />
                <Chip
                  size="small"
                  color={asset.active ? 'primary' : 'default'}
                  label={asset.active ? 'ACTIVE' : 'INACTIVE'}
                />
              </Box>
              <Typography variant="h6">{asset.assetName}</Typography>
              <Typography className={classes.mono}>{asset.assetId}</Typography>
              {asset.routePath && (
                <Typography variant="caption">{asset.routePath}</Typography>
              )}
            </Paper>
          ))}
        </Box>
        <Box mt={4}>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Box>
              <Typography variant="h6">적용·롤백 이력</Typography>
              <Typography variant="body2" color="textSecondary">
                원본 지문, 검증 결과, 런타임 백업과 최종 상태를 함께
                보관합니다.
              </Typography>
            </Box>
            <Button variant="outlined" onClick={() => void load()}>
              새로고침
            </Button>
          </Box>
          <Box mt={2} display="grid" gridGap={12}>
            {drafts.slice(0, 20).map(draft => {
              const report = draft.validationReport ?? {};
              const failures = Array.isArray(report.failures)
                ? report.failures.join(', ')
                : '';
              return (
                <Paper key={draft.draftId} variant="outlined">
                  <Box p={2}>
                    <Box
                      display="flex"
                      justifyContent="space-between"
                      alignItems="center"
                      gridGap={12}
                    >
                      <Box minWidth={0}>
                        <Typography variant="subtitle2">
                          #{draft.draftId} · {draft.assetType} · {draft.assetId}
                        </Typography>
                        <Typography variant="caption" className={classes.mono}>
                          {draft.baseFingerprint}
                        </Typography>
                      </Box>
                      <Box display="flex" alignItems="center" gridGap={8}>
                        <Chip
                          size="small"
                          color={
                            draft.status === 'APPLIED' ? 'primary' : 'default'
                          }
                          label={draft.status}
                        />
                        {draft.status === 'APPLIED' && (
                          <Button
                            size="small"
                            variant="outlined"
                            color="secondary"
                            onClick={() =>
                              void requestRollback(draft).catch(reason =>
                                setError(String(reason.message || reason)),
                              )
                            }
                          >
                            이 버전으로 롤백
                          </Button>
                        )}
                      </Box>
                    </Box>
                    <Box mt={1}>
                      <Typography variant="body2">
                        검증:{' '}
                        {String(report.validation ?? report.status ?? '-')}
                      </Typography>
                      <Typography variant="body2">
                        백업: {String(report.backup ?? '-')}
                      </Typography>
                      {failures && (
                        <Typography variant="body2" color="error">
                          실패 원인: {failures}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                </Paper>
              );
            })}
          </Box>
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
                <Typography variant="overline">{selected.assetType}</Typography>
                <Typography variant="h5">{selected.assetName}</Typography>
              </Box>
              <IconButton onClick={() => setSelected(null)}>
                <CloseIcon />
              </IconButton>
            </Box>
            <Typography className={classes.mono}>{selected.assetId}</Typography>
            <Box mt={2}>
              <Typography variant="caption">라우트</Typography>
              <Typography>{selected.routePath || '-'}</Typography>
            </Box>
            <Box mt={2}>
              <Typography variant="caption">버전 · 지문</Typography>
              <Typography className={classes.mono}>
                {selected.version} · {selected.fingerprint}
              </Typography>
            </Box>
            <Box mt={2}>
              <Typography variant="caption">동기화 시각</Typography>
              <Typography>{selected.syncedAt}</Typography>
            </Box>
            <Box mt={2}>
              <Typography variant="caption">원본 계약</Typography>
              <TextField
                fullWidth
                variant="outlined"
                label="자산명"
                margin="dense"
                value={draftName}
                onChange={event => setDraftName(event.target.value)}
              />
              <TextField
                fullWidth
                multiline
                minRows={12}
                variant="outlined"
                label="계약 JSON"
                margin="dense"
                value={draftPayload}
                onChange={event => setDraftPayload(event.target.value)}
              />
              <Box display="flex" gridGap={12} mt={2}>
                <Button
                  color="primary"
                  variant="contained"
                  disabled={draftStatus.startsWith('PROMOTED')}
                  onClick={() =>
                    void saveAndValidateDraft().catch(reason =>
                      setError(String(reason.message || reason)),
                    )
                  }
                >
                  초안 저장·계약 검증
                </Button>
                <Button
                  color="primary"
                  variant="outlined"
                  disabled={draftStatus !== 'VALIDATED'}
                  onClick={() =>
                    void promoteDraft().catch(reason =>
                      setError(String(reason.message || reason)),
                    )
                  }
                >
                  승인 작업 큐 등록
                </Button>
              </Box>
              {draftStatus && (
                <Box mt={2}>
                  <Chip color="primary" label={draftStatus} />
                </Box>
              )}
            </Box>
          </Box>
        )}
      </Drawer>
    </Page>
  );
}
