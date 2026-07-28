import { useMemo, useState } from 'react';
import { Content, Header, Page } from '@backstage/core-components';
import {
  Box,
  Button,
  Chip,
  Drawer,
  Grid,
  IconButton,
  LinearProgress,
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
    gridTemplateColumns: 'minmax(0,1fr) auto',
    gap: theme.spacing(2),
    [theme.breakpoints.down('xs')]: { gridTemplateColumns: '1fr' },
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
  const [tab, setTab] = useState(0);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<ControlAssetRecord | null>(null);
  const activeCapability = capabilities[tab].code;
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

  return (
    <Page themeId="tool">
      <Header
        title="Resonance 운영·설계·개발 자산"
        subtitle="프레임워크 제어 화면을 Backstage에서 분류·추적하고 원본 기능과 연결합니다."
      />
      <Content>
        <Box className={classes.hero}>
          <Typography variant="h5">Framework Control Plane</Typography>
          <Typography variant="body2">
            원본 화면을 중복 복제하지 않고 하나의 자산 계약으로 관리합니다.
            Backstage 네이티브 전환 전까지 기존 런타임 링크를 유지합니다.
          </Typography>
        </Box>
        <Grid container spacing={2}>
          {[
            ['고유 제어 자산', CONTROL_ASSET_SUMMARY.total],
            ['운영', CONTROL_ASSET_SUMMARY.operations],
            ['설계', CONTROL_ASSET_SUMMARY.design],
            ['개발', CONTROL_ASSET_SUMMARY.development],
            ['병합 계약', CONTROL_ASSET_SUMMARY.mergedContracts],
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
        </Paper>

        <Typography variant="body2" color="textSecondary" gutterBottom>
          {filtered.length.toLocaleString()}개 자산
        </Typography>
        <Box className={classes.grid}>
          {filtered.map(record => (
            <Paper
              key={`${record.screenId}-${record.sequence}`}
              className={classes.card}
              elevation={0}
              role="button"
              tabIndex={0}
              onClick={() => setSelected(record)}
            >
              <Box display="flex" justifyContent="space-between">
                <Typography variant="overline">#{record.sequence}</Typography>
                <Chip size="small" label={record.implementationStatus} />
              </Box>
              <Typography variant="h6">{record.screenName}</Typography>
              <Typography className={classes.path}>{record.routePath}</Typography>
              <Box className={classes.chips} mt={1.5}>
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
              ['이관 방식', selected.migrationMode],
              ['설계 상태', selected.designStatus],
              ['구현 상태', selected.implementationStatus],
              ['액터', selected.actorCodes.join(', ')],
              ['프로세스', selected.processCodes.join(', ')],
              ['데이터 계약', selected.dataContracts.join(', ')],
              ['섹션', selected.sections.join(', ')],
              ['미해결 항목', selected.gaps.join(', ') || '없음'],
              ['소스', selected.sourceRef],
            ].map(([label, value]) => (
              <Box className={classes.detailRow} key={label}>
                <Typography variant="caption" color="textSecondary">
                  {label}
                </Typography>
                <Typography variant="body2">{value}</Typography>
              </Box>
            ))}
            <Box mt={3}>
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
