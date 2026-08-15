import { ChangeEvent, useCallback, useEffect, useRef, useState } from 'react';
import { fetchApiRef, useApi } from '@backstage/core-plugin-api';
import { Box, Button, Chip, LinearProgress, Paper, TextField, Typography } from '@material-ui/core';
import CloudUploadIcon from '@material-ui/icons/CloudUpload';
import {
  persistRequirementDocumentSlot,
  readRequirementDocumentSlot,
  withRequirementDocumentSlot,
} from './requirementDocumentSlot';
import { pollRequirementPublication } from './requirementPublicationPolling';

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
  const [documentSlot, setDocumentSlot] = useState(() => readRequirementDocumentSlot(
    projectId,
    typeof window === 'undefined' ? undefined : window.localStorage,
  ));
  const [documents, setDocuments] = useState<RequirementDocument[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const publicationPollRef = useRef<AbortController | null>(null);

  const refresh = useCallback(async () => {
    if (!projectId) return;
    const response = await fetchApi.fetch(`/api/resonance-projects/${encodeURIComponent(projectId)}/requirements`);
    if (!response.ok) throw new Error(`요구분석 이력 조회 실패 (${response.status})`);
    const payload = (await response.json()) as { documents?: RequirementDocument[] };
    const nextDocuments = payload.documents ?? [];
    setDocuments(nextDocuments);
    return nextDocuments;
  }, [fetchApi, projectId]);

  const pollDocumentPublication = useCallback((documentId: string, signal: AbortSignal) =>
    pollRequirementPublication({
      signal,
      readReceipt: async () => {
        const response = await fetchApi.fetch(`/api/resonance-projects/${encodeURIComponent(projectId)}/requirements/${encodeURIComponent(documentId)}/publication/reconcile`, {
          method: 'POST', signal,
        });
        const payload = (await response.json()) as { status?: string; message?: string };
        if (!response.ok) throw new Error(payload.message ?? `생성 상태 확인 실패 (${response.status})`);
        return payload;
      },
    }), [fetchApi, projectId]);

  useEffect(() => {
    const controller = new AbortController();
    publicationPollRef.current?.abort();
    publicationPollRef.current = controller;
    void refresh().then(async nextDocuments => {
      if (!nextDocuments) return;
      const queued = nextDocuments.find(document => document.status.includes('QUEUED'));
      if (!queued) return;
      const result = await pollDocumentPublication(queued.documentId, controller.signal);
      if (controller.signal.aborted) return;
      if (result.outcome === 'TERMINAL') {
        const status = String(result.receipt?.status ?? 'FAILED');
        setMessage(status === 'APPLIED' ? `완료: 설계 v${queued.designVersion} · APPLIED` : `${status}: ${result.receipt?.message ?? '생성 작업이 종료되었습니다.'}`);
        await refresh();
      } else if (result.outcome === 'TIMEOUT') {
        setMessage(`진행 중: 설계 v${queued.designVersion} · 자동 확인 시간 초과, 이력에서 다시 확인합니다.`);
      }
    }).catch(error => { if (!controller.signal.aborted) setMessage(String(error)); });
    return () => controller.abort();
  }, [pollDocumentPublication, refresh]);
  useEffect(() => () => publicationPollRef.current?.abort(), []);
  useEffect(() => {
    setDocumentSlot(readRequirementDocumentSlot(
      projectId,
      typeof window === 'undefined' ? undefined : window.localStorage,
    ));
  }, [projectId]);

  const selectFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0] ?? null;
    setFile(selected); setMessage('');
    setExtractedText(selected && /\.(txt|md|csv|json)$/i.test(selected.name) ? await selected.text() : '');
  };

  const automate = async () => {
    if (!file) return;
    publicationPollRef.current?.abort();
    const controller = new AbortController();
    publicationPollRef.current = controller;
    setBusy(true); setMessage('');
    try {
      const response = await fetchApi.fetch(`/api/resonance-projects/${encodeURIComponent(projectId)}/requirements/automate`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify(withRequirementDocumentSlot({ fileName: file.name, mimeType: file.type, contentBase64: await toBase64(file), extractedText, sourceImmediate: true }, documentSlot)),
      });
      const payload = (await response.json()) as { documentId?: string; message?: string; requirementCount?: number; designVersion?: number; status?: string };
      if (!response.ok) throw new Error(`${payload.status ?? 'FAILED'}: ${payload.message ?? `자동화 실패 (${response.status})`}`);
      let finalStatus = String(payload.status ?? 'GENERATION_QUEUED');
      if (finalStatus.includes('QUEUED') && payload.documentId) {
        setMessage(`진행 중: 설계 v${payload.designVersion ?? '-'} 코드 생성 상태를 자동 확인합니다.`);
        const result = await pollDocumentPublication(payload.documentId, controller.signal);
        if (result.outcome === 'CANCELLED') return;
        if (result.outcome === 'TERMINAL') {
          finalStatus = String(result.receipt?.status ?? 'FAILED');
          if (finalStatus === 'FAILED' || finalStatus === 'REVIEW_REQUIRED') {
            await refresh();
            throw new Error(`${finalStatus}: ${result.receipt?.message ?? '생성 작업이 종료되었습니다.'}`);
          }
        } else {
          setMessage(`진행 중: 설계 v${payload.designVersion ?? '-'} · 자동 확인 시간 초과, 이력에서 다시 확인합니다.`);
          await refresh();
          return;
        }
      }
      setMessage(`완료: 요구사항 ${payload.requirementCount ?? 0}건 · 설계 v${payload.designVersion ?? '-'} · ${finalStatus}`);
      await refresh();
    } catch (error) { if (!controller.signal.aborted) { await refresh().catch(() => undefined); setMessage(error instanceof Error ? error.message : String(error)); } }
    finally { if (!controller.signal.aborted) setBusy(false); }
  };

  return (
    <Paper variant="outlined" style={{ padding: 24 }}>
      <Typography variant="h6">요구분석서 기반 자동 개발</Typography>
      <Typography variant="body2" color="textSecondary">요구사항·액터·프로세스·화면·권한·API를 구조화 SOURCE 정본에 저장하고 코드 생성을 즉시 등록합니다. QA·시각·E2E 검증은 게시 품질 게이트로 이어집니다.</Typography>
      {busy && <Box mt={2}><LinearProgress /></Box>}
      <Box mt={2} display="flex" flexWrap="wrap" style={{ gap: 12 }}>
        <Button component="label" variant="outlined" startIcon={<CloudUploadIcon />} disabled={busy}>요구분석서 선택<input hidden type="file" accept=".txt,.md,.csv,.json,.pdf,.docx,.xlsx" onChange={selectFile} /></Button>
        <Typography variant="body2" style={{ alignSelf: 'center' }}>{file?.name ?? '선택된 파일 없음'}</Typography>
      </Box>
      <Box mt={2}><TextField fullWidth multiline minRows={8} variant="outlined" label="추출된 요구사항 텍스트" helperText="TXT·MD·CSV·JSON은 자동 추출됩니다. PDF·DOCX·XLSX는 추출 텍스트를 확인하거나 붙여 넣으세요." value={extractedText} onChange={event => setExtractedText(event.target.value)} /></Box>
      <Box mt={2}><TextField fullWidth variant="outlined" label="프로젝트 문서 슬롯" helperText="파일명이 바뀌어도 같은 업무로 갱신하려면 이 프로젝트에서 동일한 슬롯을 유지하세요." value={documentSlot} onChange={event => setDocumentSlot(persistRequirementDocumentSlot(projectId, event.target.value, typeof window === 'undefined' ? undefined : window.localStorage))} /></Box>
      <Box mt={1} display="flex" alignItems="center" flexWrap="wrap" style={{ gap: 12 }}>
        <Button color="primary" variant="contained" disabled={busy || !file || !extractedText.trim()} onClick={automate}>SOURCE 설계·엔드포인트 즉시 반영</Button>
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
