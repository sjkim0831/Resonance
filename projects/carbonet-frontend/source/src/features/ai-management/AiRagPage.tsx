import { useEffect, useState, useCallback } from "react";
import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { useFrontendSession } from "../../app/hooks/useFrontendSession";
import { logGovernanceScope } from "../../app/policy/debug";
import { buildLocalizedPath, getNavigationEventName, isEnglish } from "../../lib/navigation/runtime";
import { AdminPageShell } from "../admin-entry/AdminPageShell";
import { PageStatusNotice } from "../admin-ui/common";
import { AdminWorkspacePageFrame } from "../admin-ui/pageFrames";
import { fetchAiRag, generateKrdsCode, type KrdsCodeGenerationResult } from "../../lib/api/aiManagement";
import { SimpleTable, SummaryCards, TabBar, text, rowsOf, Badge } from "./aiShared";

type TabKey = "generator" | "documents" | "chunks" | "vectordb" | "verify";

interface DocumentModalProps {
  doc: Record<string, unknown> | null;
  onClose: () => void;
  onSave: (data: { name: string; source: string; status: string }) => void;
}

function DocumentModal({ doc, onClose, onSave }: DocumentModalProps) {
  const en = isEnglish();
  const [formData, setFormData] = useState<{ name: string; source: string; status: string }>({
    name: String(doc?.name || ""),
    source: String(doc?.source || "PDF"),
    status: String(doc?.status || "ACTIVE"),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
        <h3 className="mb-4 text-lg font-black">{doc ? (en ? "Edit Document" : "문서 편집") : (en ? "Upload Document" : "문서 업로드")}</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium">{en ? "Document Name" : "문서명"}</label>
            <input
              type="text"
              className="gov-input mt-1 w-full"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder={en ? "Enter document name" : "문서명을 입력하세요"}
            />
          </div>
          <div>
            <label className="block text-sm font-medium">{en ? "Source Type" : "소스 유형"}</label>
            <select
              className="gov-select mt-1 w-full"
              value={formData.source}
              onChange={(e) => setFormData({ ...formData, source: e.target.value })}
            >
              <option value="PDF">PDF</option>
              <option value="DOCX">DOCX</option>
              <option value="XLSX">XLSX</option>
              <option value="HTML">HTML</option>
              <option value="MARKDOWN">Markdown</option>
              <option value="GIT">Git Repository</option>
            </select>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button className="gov-btn gov-btn-outline" onClick={onClose} type="button">{en ? "Cancel" : "취소"}</button>
          <button className="gov-btn gov-btn-primary" onClick={() => onSave(formData)} type="button">{en ? "Save" : "저장"}</button>
        </div>
      </div>
    </div>
  );
}

interface ChunkDetailModalProps {
  chunk: Record<string, unknown> | null;
  onClose: () => void;
}

function ChunkDetailModal({ chunk, onClose }: ChunkDetailModalProps) {
  const en = isEnglish();
  if (!chunk) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="h-[80vh] w-full max-w-4xl overflow-auto rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-black">{en ? "Chunk Detail" : "청크 상세"}</h3>
          <button className="gov-btn gov-btn-outline" onClick={onClose} type="button">{en ? "Close" : "닫기"}</button>
        </div>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-[var(--kr-gov-text-secondary)]">{en ? "Document" : "문서"}</p>
              <p className="font-medium">{text(chunk.docName)}</p>
            </div>
            <div>
              <p className="text-sm text-[var(--kr-gov-text-secondary)]">{en ? "Chunk Index" : "청크 번호"}</p>
              <p className="font-medium">{text(chunk.chunkIndex)}</p>
            </div>
            <div>
              <p className="text-sm text-[var(--kr-gov-text-secondary)]">Tokens</p>
              <p className="font-medium">{text(chunk.tokens)}</p>
            </div>
            <div>
              <p className="text-sm text-[var(--kr-gov-text-secondary)]">{en ? "Status" : "상태"}</p>
              <Badge value={chunk.status} />
            </div>
          </div>
          <div>
            <p className="text-sm text-[var(--kr-gov-text-secondary)]">{en ? "Content Preview" : "내용 미리보기"}</p>
            <div className="mt-2 max-h-64 overflow-auto rounded border border-[var(--kr-gov-border-light)] bg-slate-50 p-4">
              <pre className="whitespace-pre-wrap text-sm">{text(chunk.content)}</pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AiRagPage() {
  const en = isEnglish();
  const session = useFrontendSession();
  const [tab, setTab] = useState<TabKey>("generator");
  const [status, setStatus] = useState("ALL");
  const [source, setSource] = useState("ALL");
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedChunk, setSelectedChunk] = useState<Record<string, unknown> | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [generationPrompt, setGenerationPrompt] = useState("");
  const [generationTarget, setGenerationTarget] = useState<"REACT_TSX" | "HTML" | "SECTION" | "COMPONENT">("REACT_TSX");
  const [generationResult, setGenerationResult] = useState<KrdsCodeGenerationResult | null>(null);
  const [generationError, setGenerationError] = useState("");
  const [generating, setGenerating] = useState(false);

  const state = useAsyncValue(() => fetchAiRag({ status: status === "ALL" ? undefined : status, source: source === "ALL" ? undefined : source }), [status, source]);
  const payload = state.value;

  useEffect(() => {
    logGovernanceScope("PAGE", "ai-rag", { language: en ? "en" : "ko" });
  }, [en]);
  useEffect(() => {
    function handleNavigationSync() {
      void state.reload();
      void session.reload();
    }
    window.addEventListener(getNavigationEventName(), handleNavigationSync);
    return () => window.removeEventListener(getNavigationEventName(), handleNavigationSync);
  }, [state, session]);

  const tabs = [
    { key: "generator", label: en ? "KRDS Code Generator" : "KRDS 코드 생성" },
    { key: "documents", label: en ? "Documents" : "문서" },
    { key: "chunks", label: en ? "Chunks" : "청크" },
    { key: "vectordb", label: en ? "Vector DB" : "벡터DB" },
    { key: "verify", label: en ? "Verification" : "검증" },
  ];

  const filteredDocuments = rowsOf(payload?.documents || []).filter((d: Record<string, unknown>) =>
    searchQuery ? String(d.name || "").toLowerCase().includes(searchQuery.toLowerCase()) : true
  );

  const filteredChunks = rowsOf(payload?.chunks || []).filter((c: Record<string, unknown>) =>
    searchQuery ? String(c.docName || "").toLowerCase().includes(searchQuery.toLowerCase()) : true
  );

  const cols: Record<TabKey, any[]> = {
    generator: [],
    documents: [
      { key: "name", label: en ? "Name" : "문서명" },
      { key: "type", label: en ? "Type" : "유형" },
      { key: "source", label: en ? "Source" : "출처" },
      { key: "chunkCount", label: en ? "Chunks" : "청크 수" },
      { key: "duplicateRate", label: en ? "Dup Rate" : "중복률", badge: true },
      { key: "status", label: en ? "Status" : "상태", badge: true },
      { key: "indexedAt", label: en ? "Indexed" : "색인일" },
    ],
    chunks: [
      { key: "docName", label: en ? "Document" : "문서" },
      { key: "chunkIndex", label: "#" },
      { key: "content", label: en ? "Preview" : "미리보기", wide: true },
      { key: "tokens", label: "Tokens" },
      { key: "status", label: en ? "Status" : "상태", badge: true },
    ],
    vectordb: [
      { key: "name", label: en ? "Index" : "인덱스명" },
      { key: "type", label: "Type" },
      { key: "dimension", label: "Dimension" },
      { key: "totalChunks", label: en ? "Total" : "전체 청크" },
      { key: "indexSize", label: en ? "Size" : "크기" },
      { key: "status", label: en ? "Status" : "상태", badge: true },
      { key: "lastUpdated", label: en ? "Updated" : "최종 갱신" },
    ],
    verify: [
      { key: "query", label: en ? "Query" : "검색어", wide: true },
      { key: "topChunks", label: en ? "Results" : "결과 수" },
      { key: "relevance", label: en ? "Relevance" : "관련도", badge: true },
      { key: "status", label: en ? "Status" : "상태", badge: true },
      { key: "verifiedAt", label: en ? "Verified" : "검증일" },
    ],
  };

  const handleSaveDocument = useCallback((data: Record<string, unknown>) => {
    console.log("Saving document:", data);
    setShowUploadModal(false);
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!generationPrompt.trim() || generating) return;
    setGenerating(true);
    setGenerationError("");
    setGenerationResult(null);
    try {
      setGenerationResult(await generateKrdsCode({ prompt: generationPrompt.trim(), target: generationTarget }));
    } catch (error) {
      setGenerationError(error instanceof Error ? error.message : String(error));
    } finally {
      setGenerating(false);
    }
  }, [generationPrompt, generationTarget, generating]);

  return (
    <AdminPageShell
      breadcrumbs={[
        { label: en ? "Home" : "홈", href: buildLocalizedPath("/admin/", "/en/admin/") },
        { label: en ? "AI Management" : "AI 관리" },
        { label: en ? "RAG" : "RAG 관리" },
      ]}
      sidebarVariant="system"
      title={en ? "RAG Management" : "RAG 관리"}
      subtitle={en ? "Manage documents, chunks, vector DB, and search quality." : "문서, 청크, 벡터DB, 검색 품질을 관리합니다."}
      actions={
        <div className="flex gap-2">
          <button className="gov-btn gov-btn-primary" onClick={() => setShowUploadModal(true)} type="button">
            {en ? "Upload Document" : "문서 업로드"}
          </button>
          <button className="gov-btn gov-btn-outline" type="button">
            {en ? "Run Verification" : "검증 실행"}
          </button>
        </div>
      }
    >
      <AdminWorkspacePageFrame>
        {state.error && <PageStatusNotice tone="error">{state.error}</PageStatusNotice>}

        <SummaryCards cards={[
          { title: en ? "Documents" : "문서", value: text(payload?.summary?.docCount), desc: en ? "Registered documents." : "등록된 문서입니다." },
          { title: en ? "Total Chunks" : "전체 청크", value: text(payload?.summary?.totalChunks), desc: en ? "Indexed chunks." : "색인된 청크입니다." },
          { title: en ? "Avg Dup Rate" : "평균 중복률", value: text(payload?.summary?.avgDupRate), desc: en ? "Duplicate chunk ratio." : "중복 청크 비율입니다." },
          { title: en ? "Index Size" : "인덱스 크기", value: text(payload?.summary?.indexSize), desc: en ? "Vector DB storage used." : "벡터DB 사용량입니다." },
        ]} />

        <section className="gov-card">
          <TabBar
            tabs={tabs}
            active={tab}
            setActive={(k) => setTab(k as TabKey)}
            extra={tab === "generator" ? undefined : (
              <div className="flex gap-2">
                <input
                  className="gov-input w-48 text-sm"
                  placeholder={en ? "Search..." : "검색..."}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <select className="gov-select text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="ALL">{en ? "All Status" : "전체 상태"}</option>
                  <option value="ACTIVE">{en ? "Active" : "활성"}</option>
                  <option value="WARNING">WARNING</option>
                  <option value="INACTIVE">{en ? "Inactive" : "비활성"}</option>
                </select>
                {tab === "documents" && (
                  <select className="gov-select text-sm" value={source} onChange={(e) => setSource(e.target.value)}>
                    <option value="ALL">{en ? "All Sources" : "전체 출처"}</option>
                    <option value="PDF">PDF</option>
                    <option value="DOCX">DOCX</option>
                    <option value="HTML">HTML</option>
                    <option value="MARKDOWN">Markdown</option>
                    <option value="GIT">Git</option>
                  </select>
                )}
              </div>
            )}
          />

          {tab === "generator" && (
            <div className="space-y-6 p-5 lg:p-7">
              <ol className="grid gap-3 md:grid-cols-4" aria-label={en ? "Generation pipeline" : "코드 생성 파이프라인"}>
                {(en
                  ? ["1. Retrieve KRDS tokens", "2. Inject system prompt", "3. Call fine-tuned LLM", "4. WCAG 2.1 AA gate"]
                  : ["1. KRDS 토큰 검색", "2. 시스템 프롬프트 주입", "3. 파인튜닝 LLM 호출", "4. WCAG 2.1 AA 검증"]
                ).map((label) => <li className="krds-component rounded-xl border border-blue-200 bg-blue-50 p-4 font-bold text-blue-950" key={label}>{label}</li>)}
              </ol>
              <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_220px]">
                <div>
                  <label className="gov-text-label font-bold" htmlFor="krds-generation-prompt">{en ? "Page or component request" : "화면·컴포넌트 요청"}</label>
                  <textarea id="krds-generation-prompt" className="gov-input mt-2 min-h-40 w-full" value={generationPrompt}
                    onChange={(event) => setGenerationPrompt(event.target.value)} maxLength={6000}
                    placeholder={en ? "Describe the task, actor, data, states, and actions." : "업무 목적, 액터, 데이터, 상태와 액션을 구체적으로 입력하세요."} />
                  <p className="gov-text-body-sm mt-2 text-slate-600">{generationPrompt.length.toLocaleString()} / 6,000</p>
                </div>
                <div>
                  <label className="gov-text-label font-bold" htmlFor="krds-generation-target">{en ? "Output type" : "출력 유형"}</label>
                  <select id="krds-generation-target" className="gov-select mt-2 w-full" value={generationTarget}
                    onChange={(event) => setGenerationTarget(event.target.value as typeof generationTarget)}>
                    <option value="REACT_TSX">React TSX</option><option value="HTML">HTML</option>
                    <option value="SECTION">Section</option><option value="COMPONENT">Component</option>
                  </select>
                  <button className="gov-btn gov-btn-primary mt-4 min-h-11 w-full" type="button" disabled={generating || !generationPrompt.trim()} onClick={handleGenerate}>
                    {generating ? (en ? "Generating and validating..." : "생성·검증 중...") : (en ? "Generate KRDS code" : "KRDS 코드 생성")}
                  </button>
                </div>
              </div>
              <div aria-live="polite">
                {generationError && <PageStatusNotice tone="error">{generationError}</PageStatusNotice>}
                {generationResult && <div className="rounded-xl border border-slate-200 bg-slate-950 p-5 text-white">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div><p className="gov-text-label text-slate-300">{generationResult.generationId} · {generationResult.model}</p>
                      <h3 className="gov-text-heading-sm mt-1 font-black">WCAG 2.1 AA: {generationResult.wcagStatus}</h3></div>
                    {generationResult.code && <button className="gov-btn gov-btn-outline bg-white text-slate-950" type="button"
                      onClick={() => navigator.clipboard.writeText(generationResult.code)}>{en ? "Copy code" : "코드 복사"}</button>}
                  </div>
                  <p className="gov-text-body-sm mt-3 text-slate-300">{generationResult.message} · RAG {generationResult.retrievedSources.length} · {generationResult.durationMs.toLocaleString()}ms</p>
                  {generationResult.violations.length > 0 && <ul className="mt-3 list-disc pl-5 text-red-300">{generationResult.violations.map((item) => <li key={item}>{item}</li>)}</ul>}
                  {generationResult.code && <pre className="mt-4 max-h-[620px] overflow-auto rounded-lg bg-black p-4 text-sm"><code>{generationResult.code}</code></pre>}
                </div>}
              </div>
            </div>
          )}

          {tab === "documents" && (
            <SimpleTable
              rows={filteredDocuments}
              columns={cols.documents}
              onRowClick={(row) => console.log("Document clicked:", row)}
            />
          )}
          {tab === "chunks" && (
            <SimpleTable
              rows={filteredChunks}
              columns={cols.chunks}
              onRowClick={(row) => setSelectedChunk(row)}
            />
          )}
          {tab === "vectordb" && (
            <SimpleTable rows={rowsOf(payload?.vectordb || [])} columns={cols.vectordb} />
          )}
          {tab === "verify" && (
            <SimpleTable rows={rowsOf(payload?.verify || [])} columns={cols.verify} />
          )}
        </section>

        {tab === "vectordb" && rowsOf(payload?.vectordb || []).length > 0 && (
          <section className="gov-card p-6">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-black">{en ? "Vector DB Controls" : "벡터DB 컨트롤"}</h4>
                <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">
                  {en ? "Manage vector indexes and reindexing" : "벡터 인덱스 및 재색인 관리"}
                </p>
              </div>
              <div className="flex gap-2">
                <button className="gov-btn gov-btn-outline" type="button">
                  {en ? "Optimize Index" : "인덱스 최적화"}
                </button>
                <button className="gov-btn gov-btn-primary" type="button">
                  {en ? "Rebuild Index" : "인덱스 재생성"}
                </button>
              </div>
            </div>
          </section>
        )}

        {showUploadModal && (
          <DocumentModal
            doc={null}
            onClose={() => setShowUploadModal(false)}
            onSave={handleSaveDocument}
          />
        )}

        {selectedChunk && (
          <ChunkDetailModal chunk={selectedChunk} onClose={() => setSelectedChunk(null)} />
        )}
      </AdminWorkspacePageFrame>
    </AdminPageShell>
  );
}
