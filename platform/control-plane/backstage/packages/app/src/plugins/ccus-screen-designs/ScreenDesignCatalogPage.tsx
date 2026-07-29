import { useMemo, useState } from 'react';
import {
  Content,
  Header,
  Page,
  Progress,
} from '@backstage/core-components';
import {
  Box,
  Button,
  Chip,
  Divider,
  Drawer,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  makeStyles,
} from '@material-ui/core';
import CloseIcon from '@material-ui/icons/Close';
import LaunchIcon from '@material-ui/icons/Launch';
import SearchIcon from '@material-ui/icons/Search';
import { CCUS_SCREEN_DESIGN_CATALOG } from './generatedCatalog';

const useStyles = makeStyles(theme => ({
  hero: {
    padding: theme.spacing(3),
    marginBottom: theme.spacing(2),
    color: '#fff',
    background:
      'linear-gradient(125deg, #063a63 0%, #075985 55%, #0f766e 100%)',
    borderRadius: 12,
  },
  metric: {
    height: '100%',
    padding: theme.spacing(2),
    border: '1px solid #dbe4ea',
    borderRadius: 10,
  },
  metricValue: { fontSize: 28, fontWeight: 800, color: '#12344d' },
  toolbar: {
    display: 'grid',
    gridTemplateColumns: 'minmax(260px, 2fr) repeat(3, minmax(150px, 1fr))',
    gap: theme.spacing(2),
    padding: theme.spacing(2),
    marginBottom: theme.spacing(2),
    [theme.breakpoints.down('sm')]: { gridTemplateColumns: '1fr' },
  },
  table: { minWidth: 1080 },
  row: { cursor: 'pointer', '&:hover': { background: '#f4f8fb' } },
  path: {
    maxWidth: 280,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontFamily: 'monospace',
    fontSize: 12,
  },
  score: { minWidth: 90 },
  drawer: {
    width: 520,
    maxWidth: '92vw',
    padding: theme.spacing(3),
    [theme.breakpoints.down('xs')]: { width: '100vw' },
  },
  detailSection: { marginTop: theme.spacing(3) },
  chips: { display: 'flex', flexWrap: 'wrap', gap: theme.spacing(1) },
  pager: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing(2),
  },
}));

type ScreenRecord = (typeof CCUS_SCREEN_DESIGN_CATALOG.records)[number];

const statusColor = (status: string) => {
  if (status === 'CONNECTED' || status === 'CONTRACTED') return 'primary';
  if (status === 'PLANNED') return 'secondary';
  return 'default';
};

export function ScreenDesignCatalogPage() {
  const classes = useStyles();
  const { summary, records, project, generatedAt } =
    CCUS_SCREEN_DESIGN_CATALOG;
  const [query, setQuery] = useState('');
  const [domain, setDomain] = useState('ALL');
  const [actor, setActor] = useState('ALL');
  const [status, setStatus] = useState('ALL');
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<ScreenRecord | null>(null);
  const pageSize = 25;
  const domains = Object.keys(summary.domains);
  const actors = useMemo(
    () => [...new Set(records.flatMap(record => record.actorCodes))].sort(),
    [records],
  );
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return records.filter(record => {
      const searchable = [
        record.screenId,
        record.screenName,
        record.routePath,
        record.actorCodes.join(' '),
        record.processCodes.join(' '),
      ]
        .join(' ')
        .toLowerCase();
      return (
        (!needle || searchable.includes(needle)) &&
        (domain === 'ALL' || record.domain === domain) &&
        (actor === 'ALL' || record.actorCodes.includes(actor)) &&
        (status === 'ALL' ||
          record.designStatus === status ||
          record.implementationStatus === status)
      );
    });
  }, [actor, domain, query, records, status]);
  const maxPage = Math.max(0, Math.ceil(filtered.length / pageSize) - 1);
  const visible = filtered.slice(page * pageSize, (page + 1) * pageSize);
  const setFilter = (setter: (value: string) => void, value: string) => {
    setter(value);
    setPage(0);
  };

  return (
    <Page themeId="tool">
      <Header
        title="CCUS 플랫폼 1,000 화면 설계"
        subtitle="액터·프로세스·화면·데이터 계약·테스트 추적 카탈로그"
      />
      <Content>
        <Box className={classes.hero}>
          <Typography variant="h5">
            {project.projectName} 설계 기준선
          </Typography>
          <Typography variant="body2">
            설계 생성 시각 {new Date(generatedAt).toLocaleString('ko-KR')} ·
            화면을 선택하면 연결 계약과 구현 상태를 확인할 수 있습니다.
          </Typography>
        </Box>

        <Grid container spacing={2}>
          {[
            ['전체 화면', summary.screenCount],
            ['액터', summary.actorCount],
            ['프로세스', summary.processCount],
            ['테스트 시나리오', summary.testCount],
            ['구현 연결', summary.connectedCount],
            ['구현 예정', summary.plannedCount],
          ].map(([label, value]) => (
            <Grid item xs={6} sm={4} lg={2} key={String(label)}>
              <Paper className={classes.metric} elevation={0}>
                <Typography variant="caption">{label}</Typography>
                <Typography className={classes.metricValue}>{value}</Typography>
              </Paper>
            </Grid>
          ))}
        </Grid>

        <Paper className={classes.toolbar} elevation={0}>
          <TextField
            variant="outlined"
            size="small"
            label="화면·경로·액터·프로세스 검색"
            value={query}
            onChange={event => setFilter(setQuery, event.target.value)}
            InputProps={{ startAdornment: <SearchIcon fontSize="small" /> }}
          />
          <FormControl variant="outlined" size="small">
            <InputLabel>업무 영역</InputLabel>
            <Select
              value={domain}
              onChange={event =>
                setFilter(setDomain, event.target.value as string)
              }
              label="업무 영역"
            >
              <MenuItem value="ALL">전체 업무 영역</MenuItem>
              {domains.map(item => (
                <MenuItem value={item} key={item}>
                  {item} ({summary.domains[item as keyof typeof summary.domains]})
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl variant="outlined" size="small">
            <InputLabel>액터</InputLabel>
            <Select
              value={actor}
              onChange={event =>
                setFilter(setActor, event.target.value as string)
              }
              label="액터"
            >
              <MenuItem value="ALL">전체 액터</MenuItem>
              {actors.map(item => (
                <MenuItem value={item} key={item}>
                  {item}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl variant="outlined" size="small">
            <InputLabel>설계·구현 상태</InputLabel>
            <Select
              value={status}
              onChange={event =>
                setFilter(setStatus, event.target.value as string)
              }
              label="설계·구현 상태"
            >
              <MenuItem value="ALL">전체 상태</MenuItem>
              {['DESIGNED', 'CONTRACTED', 'GENERATED', 'CONNECTED', 'PLANNED'].map(
                item => (
                  <MenuItem value={item} key={item}>
                    {item}
                  </MenuItem>
                ),
              )}
            </Select>
          </FormControl>
        </Paper>

        <TableContainer component={Paper}>
          <Table className={classes.table} size="small">
            <TableHead>
              <TableRow>
                <TableCell>순서</TableCell>
                <TableCell>화면</TableCell>
                <TableCell>업무 영역</TableCell>
                <TableCell>액터</TableCell>
                <TableCell>프로세스</TableCell>
                <TableCell>설계</TableCell>
                <TableCell>구현</TableCell>
                <TableCell>품질</TableCell>
                <TableCell>테스트</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {visible.map(record => (
                <TableRow
                  className={classes.row}
                  key={`${record.screenId}-${record.sequence}`}
                  onClick={() => setSelected(record)}
                  tabIndex={0}
                >
                  <TableCell>{record.sequence}</TableCell>
                  <TableCell>
                    <Typography variant="body2">{record.screenName}</Typography>
                    <div className={classes.path}>{record.routePath}</div>
                  </TableCell>
                  <TableCell>{record.domain}</TableCell>
                  <TableCell>{record.actorCodes.join(', ')}</TableCell>
                  <TableCell>{record.processCodes.join(', ')}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={record.designStatus}
                      color={statusColor(record.designStatus)}
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={record.implementationStatus}
                      color={statusColor(record.implementationStatus)}
                    />
                  </TableCell>
                  <TableCell className={classes.score}>
                    <Typography variant="caption">
                      {record.qualityScore}점
                    </Typography>
                    <LinearProgress
                      variant="determinate"
                      value={record.qualityScore}
                    />
                  </TableCell>
                  <TableCell>{record.testCount}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Box className={classes.pager}>
            <Typography variant="body2">
              {filtered.length.toLocaleString()}개 중{' '}
              {filtered.length ? page * pageSize + 1 : 0}–
              {Math.min((page + 1) * pageSize, filtered.length)}
            </Typography>
            <Box>
              <Button
                disabled={page === 0}
                onClick={() => setPage(value => Math.max(0, value - 1))}
              >
                이전
              </Button>
              <Button
                disabled={page >= maxPage}
                onClick={() => setPage(value => Math.min(maxPage, value + 1))}
              >
                다음
              </Button>
            </Box>
          </Box>
        </TableContainer>

        <Drawer
          anchor="right"
          open={Boolean(selected)}
          onClose={() => setSelected(null)}
        >
          {selected ? (
            <Box className={classes.drawer}>
              <Box display="flex" justifyContent="space-between">
                <Box>
                  <Typography variant="overline">
                    #{selected.sequence} · {selected.domain}
                  </Typography>
                  <Typography variant="h5">{selected.screenName}</Typography>
                  <Typography variant="caption">{selected.screenId}</Typography>
                </Box>
                <IconButton onClick={() => setSelected(null)}>
                  <CloseIcon />
                </IconButton>
              </Box>
              <Divider />

              <Box className={classes.detailSection}>
                <Typography variant="subtitle2">실행 경로</Typography>
                <Typography className={classes.path}>
                  {selected.routePath}
                </Typography>
                <Button
                  startIcon={<LaunchIcon />}
                  onClick={() =>
                    window.open(
                      `http://172.16.1.232${selected.routePath}`,
                      '_blank',
                      'noopener,noreferrer',
                    )
                  }
                >
                  실제 화면 열기
                </Button>
              </Box>

              {[
                ['담당 액터', selected.actorCodes],
                ['연결 프로세스', selected.processCodes],
                ['화면 섹션', selected.sections],
                ['공통 데이터 계약', selected.dataContracts],
                ['필수 테스트', selected.requiredScenarios],
                ['확인 필요 항목', selected.gaps],
              ].map(([label, values]) => (
                <Box className={classes.detailSection} key={String(label)}>
                  <Typography variant="subtitle2">{label}</Typography>
                  <Box className={classes.chips}>
                    {(values as readonly (string | number)[]).length ? (
                      (values as readonly (string | number)[]).map(value => (
                        <Chip
                          size="small"
                          variant="outlined"
                          label={value}
                          key={String(value)}
                        />
                      ))
                    ) : (
                      <Typography variant="body2">등록 항목 없음</Typography>
                    )}
                  </Box>
                </Box>
              ))}

              <Box className={classes.detailSection}>
                <Typography variant="subtitle2">설계 추적성</Typography>
                <Typography variant="body2">
                  품질 {selected.qualityScore} · 전문성{' '}
                  {selected.professionalScore} · 런타임{' '}
                  {selected.runtimeScore} · 추적성{' '}
                  {selected.traceabilityScore}/10
                </Typography>
                <Typography variant="body2">
                  계약 ID: {selected.contractIds.join(', ') || '설계 계약 대기'}
                </Typography>
                <Typography variant="body2">
                  원본: {selected.sourceRef}
                </Typography>
              </Box>
            </Box>
          ) : (
            <Progress />
          )}
        </Drawer>
      </Content>
    </Page>
  );
}

