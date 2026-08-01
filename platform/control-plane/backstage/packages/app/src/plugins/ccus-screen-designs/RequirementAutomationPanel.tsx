import { ChangeEvent, useCallback, useEffect, useState } from 'react';
import { fetchApiRef, useApi } from '@backstage/core-plugin-api';
import { Box, Button, Checkbox, Chip, FormControlLabel, LinearProgress, Paper, TextField, Typography } from '@material-ui/core';
import CloudUploadIcon from '@material-ui/icons/CloudUpload';

type RequirementDocument = {
  documentId: string; fileName: string; status: string; requirementCount: number;
  designVersion: number; processCode: string; createdAt: string;
};

const toBase64 = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onerror = () => reject(reader.error);
  reader.onload = () => resolve(String(reader.result ?? '').replace(/^data:[^,]*,/, ''));
  reader.readAsDataURL(file);
});

export function RequirementAutomationPanel({ projectId }: { projectId: string }) {
  const fetchApi = useApi(fetchApiRef);
  const [file, setFile] = useState<File | null>(null);
  const [extractedText, setExtractedText] = useState('');
  const [autoPromote, setAutoPromote] = useState(true);
  const [documents, setDocuments] = useState<RequirementDocument[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const refresh = useCallback(async () => {
    if (!projectId) return;
    const response = await fetchApi.fetch(`/api/resonance-projects/${encodeURIComponent(projectId)}/requirements`);
    if (!response.ok) throw new Error(`요구분석 이력 조회 실패 (${response.status})`);
    const payload = (await response.json()) as { documents?: RequirementDocument[] };
    setDocuments(payload.documents ?? []);
  }, [fetchApi, projectId]);

  useEffect(() => { void refresh().catch(error => setMessage(String(error))); }, [refresh]);

  const selectFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0] ?? null;
    setFile(selected); setMessage('');
    setExtractedText(selected && /\.(txt|md|csv|json)$/i.test(selected.name) ? await selected.text() : '');
  };

  const automate = async () => {
    if (!file) return;
    setBusy(true); setMessage('');
    try {
      const response = await fetchApi.fetch(`/api/resonance-projects/${encodeURIComponent(projectId)}/requirements/automate`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ fileName: file.name, mimeType: file.type, contentBase64: await toBase64(file), extractedText, autoPromote }),
      });
      const payload = (await response.json()) as { message?: string; requirementCount?: number; designVersion?: number; status?: string };
      if (!response.ok) throw new Error(payload.message ?? `자동화 실패 (${response.status})`);
      setMessage(`완료: 요구사항 ${payload.requirementCount ?? 0}건 · 설계 v${payload.designVersion ?? '-'} · ${payload.status}`);
      await refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
    finally { setBusy(false); }
  };

  return (
    <Paper variant="outlined" style={{ padding: 24 }}>
      <Typography variant="h6">요구분석서 기반 자동 개발</Typography>
      <Typography variant="body2" color="textSecondary">파일 해시 저장 → 요구사항·액터·프로세스·화면·필드·API 계약 → 설계 검증 → 최대 1,000화면 생성 큐를 한 번에 실행합니다.</Typography>
      {busy && <Box mt={2}><LinearProgress /></Box>}
      <Box mt={2} display="flex" flexWrap="wrap" style={{ gap: 12 }}>
        <Button component="label" variant="outlined" startIcon={<CloudUploadIcon />} disabled={busy}>요구분석서 선택<input hidden type="file" accept=".txt,.md,.csv,.json,.pdf,.docx,.xlsx" onChange={selectFile} /></Button>
        <Typography variant="body2" style={{ alignSelf: 'center' }}>{file?.name ?? '선택된 파일 없음'}</Typography>
      </Box>
      <Box mt={2}><TextField fullWidth multiline minRows={8} variant="outlined" label="추출된 요구사항 텍스트" helperText="TXT·MD·CSV·JSON은 자동 추출됩니다. PDF·DOCX·XLSX는 추출 텍스트를 확인하거나 붙여 넣으세요." value={extractedText} onChange={event => setExtractedText(event.target.value)} /></Box>
      <Box mt={1} display="flex" alignItems="center" flexWrap="wrap" style={{ gap: 12 }}>
        <FormControlLabel control={<Checkbox checked={autoPromote} onChange={event => setAutoPromote(event.target.checked)} color="primary" />} label="검증 통과 시 설계 승격 및 생성 큐 자동 실행" />
        <Button color="primary" variant="contained" disabled={busy || !file || !extractedText.trim()} onClick={automate}>설계부터 엔드포인트까지 실행</Button>
      </Box>
      {message && <Box mt={2}><Typography color={message.startsWith('완료') ? 'primary' : 'error'}>{message}</Typography></Box>}
      <Box mt={3}>
        <Typography variant="subtitle1">자동화 이력 ({documents.length})</Typography>
        {documents.map(document => <Box key={document.documentId} mt={1} p={2} border="1px solid #dbe4ea" borderRadius={8}>
          <Box display="flex" justifyContent="space-between" flexWrap="wrap" style={{ gap: 8 }}><Typography variant="subtitle2">{document.fileName}</Typography><Chip size="small" label={document.status} color={document.status.includes('QUEUED') ? 'primary' : 'default'} /></Box>
          <Typography variant="caption" color="textSecondary">{document.processCode} · 요구사항/화면/API {document.requirementCount}건 · 설계 v{document.designVersion}</Typography>
        </Box>)}
        {!documents.length && <Typography variant="body2" color="textSecondary">등록된 요구분석서가 없습니다.</Typography>}
      </Box>
    </Paper>
  );
}
