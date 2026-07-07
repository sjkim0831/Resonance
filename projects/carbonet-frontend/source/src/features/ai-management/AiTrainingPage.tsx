import { useEffect, useState, useCallback } from "react";
import { useAsyncValue } from "../../app/hooks/useAsyncValue";
import { useFrontendSession } from "../../app/hooks/useFrontendSession";
import { logGovernanceScope } from "../../app/policy/debug";
import { buildLocalizedPath, getNavigationEventName, isEnglish } from "../../lib/navigation/runtime";
import { AdminPageShell } from "../admin-entry/AdminPageShell";
import { PageStatusNotice } from "../admin-ui/common";
import { AdminWorkspacePageFrame } from "../admin-ui/pageFrames";
import { fetchAiTraining } from "../../lib/api/aiManagement";
import { SimpleTable, SummaryCards, TabBar, text, rowsOf, Badge } from "./aiShared";

type TabKey = "datasets" | "candidates" | "lora" | "jobs" | "history";
type CategoryType = "ALL" | "API_DESIGN" | "SPRING_CODE" | "REACT_CODE" | "DB_SCHEMA" | "DOC_ETC";

interface CandidateDetailModalProps {
  candidate: Record<string, unknown> | null;
  onClose: () => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}

function CandidateDetailModal({ candidate, onClose, onApprove, onReject }: CandidateDetailModalProps) {
  const en = isEnglish();
  if (!candidate) return null;

  const status = String(candidate.reviewStatus || candidate.status || "").toUpperCase();
  const isPending = status.includes("AWAITING") || status.includes("PENDING");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="h-[85vh] w-full max-w-3xl overflow-auto rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-black">{en ? "Candidate Detail" : "후보 상세"}</h3>
            <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">ID: {text(candidate.id)}</p>
          </div>
          <Badge value={candidate.reviewStatus || candidate.status} />
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-[var(--kr-gov-text-secondary)]">{en ? "Category" : "카테고리"}</p>
              <p className="font-medium">{text(candidate.category)}</p>
            </div>
            <div>
              <p className="text-sm text-[var(--kr-gov-text-secondary)]">{en ? "Quality Score" : "품질 점수"}</p>
              <p className="font-medium">{candidate.score ? `${((candidate.score as number) * 100).toFixed(0)}%` : "-"}</p>
            </div>
            <div>
              <p className="text-sm text-[var(--kr-gov-text-secondary)]">{en ? "AI Classification" : "AI 분류"}</p>
              <p className="font-medium">{text(candidate.autoClass)}</p>
            </div>
            <div>
              <p className="text-sm text-[var(--kr-gov-text-secondary)]">{en ? "Confidence" : "신뢰도"}</p>
              <p className="font-medium">{candidate.confidence ? `${((candidate.confidence as number) * 100).toFixed(0)}%` : "-"}</p>
            </div>
          </div>

          <div>
            <p className="text-sm text-[var(--kr-gov-text-secondary)]">{en ? "Description" : "설명"}</p>
            <div className="mt-2 max-h-48 overflow-auto rounded border border-[var(--kr-gov-border-light)] bg-slate-50 p-4">
              <pre className="whitespace-pre-wrap text-sm">{text(candidate.description)}</pre>
            </div>
          </div>

          {candidate.reviewNotes ? (
            <div>
              <p className="text-sm text-[var(--kr-gov-text-secondary)]">{en ? "Review Notes" : "검토 메모"}</p>
              <div className="mt-2 rounded border border-amber-200 bg-amber-50 p-4">
                <pre className="whitespace-pre-wrap text-sm">{text(candidate.reviewNotes)}</pre>
              </div>
            </div>
          ) : null}
        </div>

        <div className="mt-6 flex justify-end gap-3">
          {isPending && (
            <>
              <button
                className="gov-btn bg-rose-100 text-rose-700 hover:bg-rose-200"
                onClick={() => onReject(String(candidate.id))}
                type="button"
              >
                {en ? "Reject" : "반려"}
              </button>
              <button
                className="gov-btn gov-btn-primary"
                onClick={() => onApprove(String(candidate.id))}
                type="button"
              >
                {en ? "Approve" : "승인"}
              </button>
            </>
          )}
          <button className="gov-btn gov-btn-outline" onClick={onClose} type="button">
            {en ? "Close" : "닫기"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function AiTrainingPage() {
  const en = isEnglish();
  const session = useFrontendSession();
  const [tab, setTab] = useState<TabKey>("candidates");
  const [status, setStatus] = useState("ALL");
  const [category, setCategory] = useState<CategoryType>("ALL");
  const [selectedCandidate, setSelectedCandidate] = useState<Record<string, unknown> | null>(null);

  const state = useAsyncValue(
    () => fetchAiTraining({ status: status === "ALL" ? undefined : status, type: tab === "candidates" && category !== "ALL" ? category : undefined }),
    [status, category, tab]
  );
  const payload = state.value;

  useEffect(() => {
    logGovernanceScope("PAGE", "ai-training", { language: en ? "en" : "ko" });
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
    { key: "datasets", label: en ? "Datasets" : "학습 데이터" },
    { key: "candidates", label: en ? "Approval Queue" : "승인 대기" },
    { key: "lora", label: en ? "LoRA Adapters" : "LoRA 관리" },
    { key: "jobs", label: en ? "Training Jobs" : "파인튜닝 실행" },
    { key: "history", label: en ? "History" : "학습 이력" },
  ];

  const cols: Record<TabKey, any[]> = {
    datasets: [
      { key: "name", label: en ? "Name" : "데이터셋명" },
      { key: "source", label: en ? "Source" : "출처" },
      { key: "recordCount", label: en ? "Records" : "레코드 수" },
      { key: "score", label: en ? "Quality" : "품질 점수", badge: true },
      { key: "status", label: en ? "Status" : "상태", badge: true },
      { key: "createdAt", label: en ? "Created" : "생성일" },
    ],
    candidates: [
      { key: "category", label: en ? "Category" : "카테고리", badge: true },
      { key: "description", label: en ? "Description" : "설명", wide: true },
      { key: "score", label: en ? "Quality" : "품질 점수", badge: true },
      { key: "autoClass", label: en ? "AI Class" : "AI 분류" },
      { key: "confidence", label: en ? "Confidence" : "신뢰도" },
      { key: "reviewStatus", label: en ? "Status" : "상태", badge: true },
    ],
    lora: [
      { key: "name", label: en ? "Adapter" : "어댑터명" },
      { key: "baseModel", label: en ? "Base Model" : "기반 모델" },
      { key: "rank", label: "Rank" },
      { key: "status", label: en ? "Status" : "상태", badge: true },
      { key: "accuracy", label: en ? "Accuracy" : "정확도" },
    ],
    jobs: [
      { key: "name", label: en ? "Job" : "작업명" },
      { key: "model", label: en ? "Target Model" : "대상 모델" },
      { key: "dataset", label: en ? "Dataset" : "데이터셋" },
      { key: "status", label: en ? "Status" : "상태", badge: true },
      { key: "progress", label: en ? "Progress" : "진행률" },
      { key: "startedAt", label: en ? "Started" : "시작" },
    ],
    history: [
      { key: "jobName", label: en ? "Job" : "작업명" },
      { key: "modelVersion", label: "Version" },
      { key: "accuracy", label: en ? "Accuracy" : "정확도" },
      { key: "loss", label: "Loss" },
      { key: "duration", label: en ? "Duration" : "소요시간" },
      { key: "status", label: en ? "Status" : "상태", badge: true },
    ],
  };

  const handleApprove = useCallback((id: string) => {
    console.log("Approving candidate:", id);
    setSelectedCandidate(null);
  }, []);

  const handleReject = useCallback((id: string) => {
    console.log("Rejecting candidate:", id);
    setSelectedCandidate(null);
  }, []);

  const pendingCount = payload?.summary?.pendingCount || "0";
  const candidatesData = rowsOf(payload?.candidates || []);

  return (
    <AdminPageShell
      breadcrumbs={[
        { label: en ? "Home" : "홈", href: buildLocalizedPath("/admin/", "/en/admin/") },
        { label: en ? "AI Management" : "AI 관리" },
        { label: en ? "Training" : "학습 관리" },
      ]}
      sidebarVariant="system"
      title={en ? "Training Management" : "학습 관리"}
      subtitle={en ? "Manage datasets, approve training candidates, and run fine-tuning jobs." : "데이터셋을 관리하고, 학습 후보를 승인하며, 파인튜닝을 실행합니다."}
    >
      <AdminWorkspacePageFrame>
        {state.error && <PageStatusNotice tone="error">{state.error}</PageStatusNotice>}

        <SummaryCards cards={[
          { title: en ? "Datasets" : "데이터셋", value: text(payload?.summary?.datasetCount), desc: en ? "Registered training datasets." : "등록된 학습 데이터셋입니다." },
          { title: en ? "Pending Approval" : "승인 대기", value: pendingCount, desc: en ? "Candidates awaiting review." : "검토 대기 중인 후보입니다." },
          { title: en ? "LoRA Adapters" : "LoRA 어댑터", value: text(payload?.summary?.loraCount), desc: en ? "Available adapters." : "사용 가능한 어댑터입니다." },
          { title: en ? "Running Jobs" : "실행 중", value: text(payload?.summary?.runningJobs), desc: en ? "Active training jobs." : "진행 중인 학습 작업입니다." },
        ]} />

        <section className="gov-card">
          <TabBar
            tabs={tabs}
            active={tab}
            setActive={(k) => setTab(k as TabKey)}
            extra={
              tab === "candidates" ? (
                <select className="gov-select text-sm" value={category} onChange={(e) => setCategory(e.target.value as CategoryType)}>
                  <option value="ALL">{en ? "All Categories" : "전체 카테고리"}</option>
                  <option value="API_DESIGN">API 설계</option>
                  <option value="SPRING_CODE">Spring 코드</option>
                  <option value="REACT_CODE">React 코드</option>
                  <option value="DB_SCHEMA">DB 스키마</option>
                  <option value="DOC_ETC">문서/기타</option>
                </select>
              ) : (
                <select className="gov-select text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="ALL">{en ? "All Status" : "전체 상태"}</option>
                  <option value="PENDING">PENDING</option>
                  <option value="RUNNING">RUNNING</option>
                  <option value="COMPLETED">COMPLETED</option>
                  <option value="FAILED">FAILED</option>
                </select>
              )
            }
          />

          {tab === "candidates" && (
            <>
              <SimpleTable
                rows={candidatesData}
                columns={cols.candidates}
                onRowClick={(row) => setSelectedCandidate(row)}
              />
              {candidatesData.length > 0 && (
                <div className="border-t border-[var(--kr-gov-border-light)] p-4">
                  <p className="text-sm text-[var(--kr-gov-text-secondary)]">
                    {en ? `${candidatesData.length} candidates shown. Click a row to review.` : `${candidatesData.length}개의 후보가 표시됩니다. 행을 클릭하여 검토하세요.`}
                  </p>
                </div>
              )}
            </>
          )}
          {tab === "datasets" && <SimpleTable rows={rowsOf(payload?.datasets || [])} columns={cols.datasets} />}
          {tab === "lora" && <SimpleTable rows={rowsOf(payload?.lora || [])} columns={cols.lora} />}
          {tab === "jobs" && <SimpleTable rows={rowsOf(payload?.jobs || [])} columns={cols.jobs} />}
          {tab === "history" && <SimpleTable rows={rowsOf(payload?.history || [])} columns={cols.history} />}
        </section>

        {tab === "candidates" && candidatesData.length > 0 && (
          <section className="gov-card p-6">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-black">{en ? "Bulk Actions" : "일괄 작업"}</h4>
                <p className="mt-1 text-sm text-[var(--kr-gov-text-secondary)]">
                  {en ? "Approve or reject multiple candidates at once" : "여러 후보를 한 번에 승인 또는 반려합니다"}
                </p>
              </div>
              <div className="flex gap-2">
                <button className="gov-btn gov-btn-outline" type="button">
                  {en ? "Generate Training Data" : "학습 데이터 생성"}
                </button>
              </div>
            </div>
          </section>
        )}

        {selectedCandidate && (
          <CandidateDetailModal
            candidate={selectedCandidate}
            onClose={() => setSelectedCandidate(null)}
            onApprove={handleApprove}
            onReject={handleReject}
          />
        )}
      </AdminWorkspacePageFrame>
    </AdminPageShell>
  );
}