-- AI Platform Management Schema
-- RAG Management, Training Candidates, Trace Tracking
-- Target DB: CUBRID-compatible SQL

-- ============================================
-- RAG Document Management
-- ============================================
CREATE TABLE IF NOT EXISTS ai_rag_document (
  document_id VARCHAR(80) NOT NULL,
  project_id VARCHAR(60) DEFAULT 'carbonet' NOT NULL,
  document_name VARCHAR(500) NOT NULL,
  document_type VARCHAR(80) NOT NULL,
  source_type VARCHAR(40) NOT NULL,
  source_path VARCHAR(1000),
  source_url VARCHAR(1000),
  file_hash VARCHAR(80),
  file_size BIGINT,
  version INTEGER DEFAULT 1 NOT NULL,
  parent_document_id VARCHAR(80),
  status VARCHAR(40) DEFAULT 'ACTIVE' NOT NULL,
  chunk_count INTEGER DEFAULT 0,
  duplicate_rate DOUBLE DEFAULT 0,
  indexed_at DATETIME,
  created_by VARCHAR(80) DEFAULT 'system' NOT NULL,
  frst_regist_pnttm DATETIME DEFAULT CURRENT_DATETIME NOT NULL,
  last_updt_pnttm DATETIME DEFAULT CURRENT_DATETIME NOT NULL,
  PRIMARY KEY (document_id)
);

CREATE INDEX idx_ai_rag_doc_project_status
  ON ai_rag_document (project_id, status, frst_regist_pnttm);
CREATE INDEX idx_ai_rag_doc_source
  ON ai_rag_document (source_type, status);
CREATE INDEX idx_ai_rag_doc_parent
  ON ai_rag_document (parent_document_id);

-- ============================================
-- RAG Chunk Management
-- ============================================
CREATE TABLE IF NOT EXISTS ai_rag_chunk (
  chunk_id VARCHAR(80) NOT NULL,
  document_id VARCHAR(80) NOT NULL,
  project_id VARCHAR(60) DEFAULT 'carbonet' NOT NULL,
  chunk_index INTEGER DEFAULT 0 NOT NULL,
  content_hash VARCHAR(80) NOT NULL,
  content_text CLOB,
  content_preview VARCHAR(500),
  chunk_size INTEGER DEFAULT 0,
  token_count INTEGER DEFAULT 0,
  duplicate_group_id VARCHAR(80),
  is_duplicate CHAR(1) DEFAULT 'N' NOT NULL,
  quality_score DOUBLE,
  status VARCHAR(40) DEFAULT 'ACTIVE' NOT NULL,
  embedded_yn CHAR(1) DEFAULT 'N' NOT NULL,
  embedded_at DATETIME,
  embedding_model VARCHAR(120),
  created_by VARCHAR(80) DEFAULT 'system' NOT NULL,
  frst_regist_pnttm DATETIME DEFAULT CURRENT_DATETIME NOT NULL,
  last_updt_pnttm DATETIME DEFAULT CURRENT_DATETIME NOT NULL,
  PRIMARY KEY (chunk_id)
);

CREATE INDEX idx_ai_rag_chunk_document
  ON ai_rag_chunk (document_id, chunk_index);
CREATE INDEX idx_ai_rag_chunk_project_status
  ON ai_rag_chunk (project_id, status, frst_regist_pnttm);
CREATE INDEX idx_ai_rag_chunk_duplicate
  ON ai_rag_chunk (duplicate_group_id);
CREATE INDEX idx_ai_rag_chunk_embedded
  ON ai_rag_chunk (embedded_yn, status);

-- ============================================
-- VectorDB Index Management
-- ============================================
CREATE TABLE IF NOT EXISTS ai_vectordb_index (
  index_id VARCHAR(80) NOT NULL,
  project_id VARCHAR(60) DEFAULT 'carbonet' NOT NULL,
  index_name VARCHAR(200) NOT NULL,
  index_type VARCHAR(40) DEFAULT 'chroma' NOT NULL,
  dimension INTEGER DEFAULT 1536,
  total_chunks INTEGER DEFAULT 0,
  total_documents INTEGER DEFAULT 0,
  index_size_bytes BIGINT DEFAULT 0,
  status VARCHAR(40) DEFAULT 'HEALTHY' NOT NULL,
  model_name VARCHAR(200),
  last_rebuilt_at DATETIME,
  last_updated_at DATETIME,
  created_by VARCHAR(80) DEFAULT 'system' NOT NULL,
  frst_regist_pnttm DATETIME DEFAULT CURRENT_DATETIME NOT NULL,
  last_updt_pnttm DATETIME DEFAULT CURRENT_DATETIME NOT NULL,
  PRIMARY KEY (index_id)
);

CREATE INDEX idx_ai_vectordb_project_status
  ON ai_vectordb_index (project_id, status);

-- ============================================
-- Search Verification Log
-- ============================================
CREATE TABLE IF NOT EXISTS ai_search_verification (
  verification_id VARCHAR(80) NOT NULL,
  project_id VARCHAR(60) DEFAULT 'carbonet' NOT NULL,
  query_text CLOB,
  query_hash VARCHAR(80),
  top_k INTEGER DEFAULT 10,
  returned_chunks INTEGER DEFAULT 0,
  avg_relevance_score DOUBLE,
  min_relevance_score DOUBLE,
  max_relevance_score DOUBLE,
  relevance_threshold DOUBLE DEFAULT 0.7,
  passed_yn CHAR(1) DEFAULT 'N' NOT NULL,
  failed_chunk_ids VARCHAR(500),
  verified_by VARCHAR(80) DEFAULT 'system' NOT NULL,
  verified_at DATETIME,
  created_by VARCHAR(80) DEFAULT 'system' NOT NULL,
  frst_regist_pnttm DATETIME DEFAULT CURRENT_DATETIME NOT NULL,
  last_updt_pnttm DATETIME DEFAULT CURRENT_DATETIME NOT NULL,
  PRIMARY KEY (verification_id)
);

CREATE INDEX idx_ai_search_verif_project_time
  ON ai_search_verification (project_id, frst_regist_pnttm DESC);
CREATE INDEX idx_ai_search_verif_passed
  ON ai_search_verification (passed_yn, frst_regist_pnttm DESC);

-- ============================================
-- Training Candidates
-- ============================================
CREATE TABLE IF NOT EXISTS ai_training_candidate (
  candidate_id VARCHAR(80) NOT NULL,
  project_id VARCHAR(60) DEFAULT 'carbonet' NOT NULL,
  category VARCHAR(80) NOT NULL,
  sub_category VARCHAR(120),
  source_type VARCHAR(40) NOT NULL,
  source_id VARCHAR(80),
  source_path VARCHAR(1000),
  title VARCHAR(500) NOT NULL,
  description CLOB,
  content_hash VARCHAR(80),
  content_size INTEGER,
  quality_score DOUBLE,
  ai_classification VARCHAR(80),
  auto_class_confidence DOUBLE,
  status VARCHAR(40) DEFAULT 'PENDING' NOT NULL,
  review_status VARCHAR(40) DEFAULT 'AWAITING_REVIEW' NOT NULL,
  reviewed_by VARCHAR(80),
  reviewed_at DATETIME,
  review_notes CLOB,
  approved_by VARCHAR(80),
  approved_at DATETIME,
  rejected_by VARCHAR(80),
  rejected_at DATETIME,
  dataset_id VARCHAR(80),
  dataset_version VARCHAR(40),
  created_by VARCHAR(80) DEFAULT 'system' NOT NULL,
  frst_regist_pnttm DATETIME DEFAULT CURRENT_DATETIME NOT NULL,
  last_updt_pnttm DATETIME DEFAULT CURRENT_DATETIME NOT NULL,
  PRIMARY KEY (candidate_id)
);

CREATE INDEX idx_ai_training_candidate_project_status
  ON ai_training_candidate (project_id, status, frst_regist_pnttm DESC);
CREATE INDEX idx_ai_training_candidate_category
  ON ai_training_candidate (category, status, frst_regist_pnttm DESC);
CREATE INDEX idx_ai_training_candidate_review
  ON ai_training_candidate (review_status, status, frst_regist_pnttm DESC);
CREATE INDEX idx_ai_training_candidate_source
  ON ai_training_candidate (source_type, source_id);

COMMENT ON COLUMN ai_training_candidate.category IS 'API_DESIGN, SPRING_CODE, REACT_CODE, DB_SCHEMA, DOC_ETC';
COMMENT ON COLUMN ai_training_candidate.review_status IS 'AWAITING_REVIEW, APPROVED, REJECTED, NEEDS_REVISION';

-- ============================================
-- Training Dataset
-- ============================================
CREATE TABLE IF NOT EXISTS ai_training_dataset (
  dataset_id VARCHAR(80) NOT NULL,
  project_id VARCHAR(60) DEFAULT 'carbonet' NOT NULL,
  dataset_name VARCHAR(300) NOT NULL,
  dataset_type VARCHAR(80) NOT NULL,
  version VARCHAR(40) NOT NULL,
  description CLOB,
  record_count INTEGER DEFAULT 0,
  total_size_bytes BIGINT DEFAULT 0,
  source_count INTEGER DEFAULT 0,
  quality_score DOUBLE,
  status VARCHAR(40) DEFAULT 'DRAFT' NOT NULL,
  published_yn CHAR(1) DEFAULT 'N' NOT NULL,
  published_at DATETIME,
  parent_dataset_id VARCHAR(80),
  created_by VARCHAR(80) DEFAULT 'system' NOT NULL,
  frst_regist_pnttm DATETIME DEFAULT CURRENT_DATETIME NOT NULL,
  last_updt_pnttm DATETIME DEFAULT CURRENT_DATETIME NOT NULL,
  PRIMARY KEY (dataset_id)
);

CREATE INDEX idx_ai_training_dataset_project_status
  ON ai_training_dataset (project_id, status, frst_regist_pnttm DESC);

-- ============================================
-- Detailed Trace for Observability
-- ============================================
CREATE TABLE IF NOT EXISTS ai_trace_detail (
  trace_id VARCHAR(80) NOT NULL,
  hermes_task_id VARCHAR(80),
  project_id VARCHAR(60) DEFAULT 'carbonet' NOT NULL,
  user_query CLOB,
  user_query_hash VARCHAR(80),
  response_text CLOB,
  total_duration_ms BIGINT,
  total_tokens INTEGER,
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  estimated_cost DOUBLE,
  status VARCHAR(40) DEFAULT 'SUCCESS' NOT NULL,
  error_message CLOB,
  model_used VARCHAR(120),
  model_latency_ms BIGINT,
  context_chunks INTEGER DEFAULT 0,
  context_tokens INTEGER DEFAULT 0,
  rag_retrieval_ms BIGINT,
  rag_chunks_retrieved INTEGER DEFAULT 0,
  tool_calls_count INTEGER DEFAULT 0,
  tool_calls_json CLOB,
  stages_json CLOB,
  trace_metadata_json CLOB,
  created_by VARCHAR(80) DEFAULT 'system' NOT NULL,
  frst_regist_pnttm DATETIME DEFAULT CURRENT_DATETIME NOT NULL,
  last_updt_pnttm DATETIME DEFAULT CURRENT_DATETIME NOT NULL,
  PRIMARY KEY (trace_id)
);

CREATE INDEX idx_ai_trace_project_time
  ON ai_trace_detail (project_id, frst_regist_pnttm DESC);
CREATE INDEX idx_ai_trace_status
  ON ai_trace_detail (status, frst_regist_pnttm DESC);
CREATE INDEX idx_ai_trace_hermes
  ON ai_trace_detail (hermes_task_id);

-- ============================================
-- Token Usage Tracking
-- ============================================
CREATE TABLE IF NOT EXISTS ai_token_usage (
  usage_id VARCHAR(80) NOT NULL,
  project_id VARCHAR(60) DEFAULT 'carbonet' NOT NULL,
  trace_id VARCHAR(80),
  period_date DATE NOT NULL,
  model_name VARCHAR(120) NOT NULL,
  prompt_tokens INTEGER DEFAULT 0,
  completion_tokens INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  estimated_cost DOUBLE DEFAULT 0,
  request_count INTEGER DEFAULT 0,
  avg_latency_ms BIGINT,
  created_by VARCHAR(80) DEFAULT 'system' NOT NULL,
  frst_regist_pnttm DATETIME DEFAULT CURRENT_DATETIME NOT NULL,
  last_updt_pnttm DATETIME DEFAULT CURRENT_DATETIME NOT NULL,
  PRIMARY KEY (usage_id)
);

CREATE INDEX idx_ai_token_usage_date_model
  ON ai_token_usage (period_date, model_name);
CREATE INDEX idx_ai_token_usage_project_date
  ON ai_token_usage (project_id, period_date DESC);

-- ============================================
-- Prompt Management
-- ============================================
CREATE TABLE IF NOT EXISTS ai_prompt_template (
  prompt_id VARCHAR(80) NOT NULL,
  project_id VARCHAR(60) DEFAULT 'carbonet' NOT NULL,
  prompt_name VARCHAR(300) NOT NULL,
  prompt_type VARCHAR(80) NOT NULL,
  version VARCHAR(20) NOT NULL,
  system_prompt CLOB,
  user_template CLOB,
  variables_json CLOB,
  model_name VARCHAR(120),
  temperature DOUBLE DEFAULT 0.7,
  max_tokens INTEGER,
  description CLOB,
  status VARCHAR(40) DEFAULT 'DRAFT' NOT NULL,
  active_yn CHAR(1) DEFAULT 'Y' NOT NULL,
  parent_prompt_id VARCHAR(80),
  experiment_count INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  failure_count INTEGER DEFAULT 0,
  avg_score DOUBLE,
  created_by VARCHAR(80) DEFAULT 'system' NOT NULL,
  frst_regist_pnttm DATETIME DEFAULT CURRENT_DATETIME NOT NULL,
  last_updt_pnttm DATETIME DEFAULT CURRENT_DATETIME NOT NULL,
  PRIMARY KEY (prompt_id)
);

CREATE INDEX idx_ai_prompt_project_type
  ON ai_prompt_template (project_id, prompt_type, status, frst_regist_pnttm DESC);

-- ============================================
-- Insert sample data for demonstration
-- ============================================

-- Sample RAG Documents
INSERT INTO ai_rag_document (document_id, document_name, document_type, source_type, status, chunk_count, duplicate_rate, indexed_at)
SELECT 'DOC-001', 'CCUS 통합관리 플랫폼 구축 사업지침', 'GUIDE', 'PDF', 'ACTIVE', 245, 0.12, CURRENT_DATETIME
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM ai_rag_document WHERE document_id = 'DOC-001');

INSERT INTO ai_rag_document (document_id, document_name, document_type, source_type, status, chunk_count, duplicate_rate, indexed_at)
SELECT 'DOC-002', '표준프레임워크 활용 가이드', 'GUIDE', 'MARKDOWN', 'ACTIVE', 189, 0.08, CURRENT_DATETIME
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM ai_rag_document WHERE document_id = 'DOC-002');

INSERT INTO ai_rag_document (document_id, document_name, document_type, source_type, status, chunk_count, duplicate_rate, indexed_at)
SELECT 'DOC-003', 'Carbonet Admin 화면 개발 가이드', 'DEV_GUIDE', 'HTML', 'ACTIVE', 156, 0.05, CURRENT_DATETIME
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM ai_rag_document WHERE document_id = 'DOC-003');

INSERT INTO ai_rag_document (document_id, document_name, document_type, source_type, status, chunk_count, duplicate_rate, indexed_at)
SELECT 'DOC-004', 'RFP 제안서 Template', 'RFP', 'DOCX', 'ACTIVE', 312, 0.15, CURRENT_DATETIME
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM ai_rag_document WHERE document_id = 'DOC-004');

-- Sample Training Candidates
INSERT INTO ai_training_candidate (candidate_id, category, source_type, title, description, quality_score, ai_classification, auto_class_confidence, status, review_status)
SELECT 'TC-001', 'API_DESIGN', 'HERMES_AUTO', 'REST API 설계 표준안', 'Carbonet 업무 처리 REST API 설계 표준안', 0.92, 'API_DESIGN', 0.95, 'PENDING', 'AWAITING_REVIEW'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM ai_training_candidate WHERE candidate_id = 'TC-001');

INSERT INTO ai_training_candidate (candidate_id, category, source_type, title, description, quality_score, ai_classification, auto_class_confidence, status, review_status)
SELECT 'TC-002', 'SPRING_CODE', 'HERMES_AUTO', 'Spring Service 계층 구현 패턴', 'Carbonet 표준프레임워크 기반 Service 구현 패턴', 0.88, 'SPRING_CODE', 0.91, 'PENDING', 'AWAITING_REVIEW'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM ai_training_candidate WHERE candidate_id = 'TC-002');

INSERT INTO ai_training_candidate (candidate_id, category, source_type, title, description, quality_score, ai_classification, auto_class_confidence, status, review_status)
SELECT 'TC-003', 'REACT_CODE', 'HERMES_AUTO', 'AdminPageShell 컴포넌트 패턴', '공통 AdminPageShell 컴포넌트 사용 패턴', 0.85, 'REACT_CODE', 0.89, 'APPROVED', 'APPROVED'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM ai_training_candidate WHERE candidate_id = 'TC-003');

INSERT INTO ai_training_candidate (candidate_id, category, source_type, title, description, quality_score, ai_classification, auto_class_confidence, status, review_status)
SELECT 'TC-004', 'SPRING_CODE', 'HERMES_AUTO', 'MyBatis Mapper 패턴', 'Carbonet Mapper 인터페이스 정의 패턴', 0.90, 'SPRING_CODE', 0.93, 'PENDING', 'AWAITING_REVIEW'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM ai_training_candidate WHERE candidate_id = 'TC-004');

INSERT INTO ai_training_candidate (candidate_id, category, source_type, title, description, quality_score, ai_classification, auto_class_confidence, status, review_status)
SELECT 'TC-005', 'API_DESIGN', 'HERMES_AUTO', '권한/감사 API 설계', 'Carbonet 권한 및 감사 로그 API 설계', 0.87, 'API_DESIGN', 0.88, 'REJECTED', 'REJECTED'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM ai_training_candidate WHERE candidate_id = 'TC-005');

-- Sample VectorDB Index
INSERT INTO ai_vectordb_index (index_id, index_name, index_type, dimension, total_chunks, total_documents, index_size_bytes, status, last_rebuilt_at)
SELECT 'IDX-001', 'carbonet-default-chroma', 'chroma', 1536, 42000, 1247, 524288000, 'HEALTHY', CURRENT_DATETIME
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM ai_vectordb_index WHERE index_id = 'IDX-001');

INSERT INTO ai_vectordb_index (index_id, index_name, index_type, dimension, total_chunks, total_documents, index_size_bytes, status, last_rebuilt_at)
SELECT 'IDX-002', 'carbonet-code-patterns', 'chroma', 768, 8500, 234, 104857600, 'HEALTHY', CURRENT_DATETIME
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM ai_vectordb_index WHERE index_id = 'IDX-002');

-- Sample Trace Data
INSERT INTO ai_trace_detail (trace_id, user_query, total_duration_ms, total_tokens, prompt_tokens, completion_tokens, status, model_used, rag_retrieval_ms, rag_chunks_retrieved, tool_calls_count, stages_json)
SELECT 'TRACE-001',
       'CCUS 배출권 관리고udian应该如何处理?',
       1850, 423, 318, 105, 'SUCCESS', 'qwen2.5-coder-7b',
       120, 8, 2,
       '[{"stage":"RAG_SEARCH","duration_ms":120,"status":"SUCCESS"},{"stage":"MODEL_INFER","duration_ms":1650,"status":"SUCCESS"},{"stage":"TOOL_CALL","duration_ms":80,"status":"SUCCESS"}]'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM ai_trace_detail WHERE trace_id = 'TRACE-001');

INSERT INTO ai_trace_detail (trace_id, user_query, total_duration_ms, total_tokens, prompt_tokens, completion_tokens, status, model_used, rag_retrieval_ms, rag_chunks_retrieved, tool_calls_count, stages_json)
SELECT 'TRACE-002',
       '관리자 화면을 어떻게 개발하나요?',
       2100, 512, 387, 125, 'SUCCESS', 'qwen2.5-coder-14b',
       95, 12, 3,
       '[{"stage":"RAG_SEARCH","duration_ms":95,"status":"SUCCESS"},{"stage":"MODEL_INFER","duration_ms":1890,"status":"SUCCESS"},{"stage":"TOOL_CALL","duration_ms":115,"status":"SUCCESS"}]'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM ai_trace_detail WHERE trace_id = 'TRACE-002');

INSERT INTO ai_trace_detail (trace_id, user_query, total_duration_ms, total_tokens, prompt_tokens, completion_tokens, status, model_used, error_message, stages_json)
SELECT 'TRACE-003',
       '테이블 생성을 도와주세요',
       3500, 0, 0, 0, 'FAILED', 'qwen2.5-coder-7b',
       'Database connection timeout',
       '[{"stage":"RAG_SEARCH","duration_ms":120,"status":"SUCCESS"},{"stage":"MODEL_INFER","duration_ms":3380,"status":"FAILED"}]'
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM ai_trace_detail WHERE trace_id = 'TRACE-003');

-- Sample Search Verification
INSERT INTO ai_search_verification (verification_id, query_text, top_k, returned_chunks, avg_relevance_score, passed_yn, verified_at)
SELECT 'VER-001', 'CCUS 배출권 관리 방법', 10, 8, 0.85, 'Y', CURRENT_DATETIME
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM ai_search_verification WHERE verification_id = 'VER-001');

INSERT INTO ai_search_verification (verification_id, query_text, top_k, returned_chunks, avg_relevance_score, passed_yn, verified_at)
SELECT 'VER-002', '표준프레임워크 컴포넌트 사용법', 10, 10, 0.72, 'N', CURRENT_DATETIME
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM ai_search_verification WHERE verification_id = 'VER-001');

-- Sample Token Usage
INSERT INTO ai_token_usage (usage_id, period_date, model_name, prompt_tokens, completion_tokens, total_tokens, estimated_cost, request_count)
SELECT 'USAGE-001', CURRENT_DATE, 'qwen2.5-coder-7b', 45000, 12000, 57000, 0.85, 150
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM ai_token_usage WHERE usage_id = 'USAGE-001');

INSERT INTO ai_token_usage (usage_id, period_date, model_name, prompt_tokens, completion_tokens, total_tokens, estimated_cost, request_count)
SELECT 'USAGE-002', CURRENT_DATE, 'qwen2.5-coder-14b', 28000, 8500, 36500, 1.20, 85
FROM db_root WHERE NOT EXISTS (SELECT 1 FROM ai_token_usage WHERE usage_id = 'USAGE-002');

COMMIT;