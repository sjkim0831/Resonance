# Resonance RAG Embedding Pipeline

## Purpose

AI/RAG 작업은 문서를 모델에 그대로 먹이는 흐름이 아니라, 문서와 로그를 의미 좌표로 바꾼 뒤 필요한 근거만 찾아 모델에 전달하는 흐름이다. Resonance에서는 이 파이프라인을 모델 작업의 기본 관문으로 둔다.

## End-to-End Flow

```text
[문서/로그/API/코드]
        ↓
① 수집(Ingestion)
        ↓
② 정제(Cleaning)
        ↓
③ 분할(Chunking)
        ↓
④ 임베딩(Embedding)
        ↓
⑤ 벡터DB 저장(Indexing)
        ↓
⑥ 사용자 질문
        ↓
⑦ 질문 임베딩
        ↓
⑧ 유사도 검색(Retrieval)
        ↓
⑨ 재정렬(Reranking)
        ↓
⑩ LLM 프롬프트 조합
        ↓
⑪ 답변 생성
        ↓
⑫ 로그/피드백/학습
```

## 1. 수집(Ingestion)

왕국 각지에서 두루마리를 모으는 단계다.

대상:

- 표준프레임워크 문서
- KRDS
- API 명세
- Java 코드
- React 코드
- 요구사항서와 RFP
- DB 스키마
- 로그
- 관리자 메뉴 구조

도구:

- PDF parser
- DOCX parser
- HTML parser
- Git repository reader
- DB/API reader

## 2. 정제(Cleaning)

쓸모없는 부분을 제거한다.

제거 대상:

- 페이지 번호
- 공백 잡음
- 중복 헤더/푸터
- 특수문자 깨짐
- 광고/불필요 문구

## 3. 분할(Chunking)

긴 문서를 모델과 검색기가 다룰 수 있는 조각으로 나눈다.

권장값:

- 일반 문서: 300~1000 tokens
- overlap: 50~100 tokens
- 코드: class, method, function boundary 우선

예:

- `UserService.java` -> `login()` chunk
- `UserService.java` -> `register()` chunk

## 4. 임베딩(Embedding)

문장을 숫자 좌표로 바꾸는 핵심 단계다.

예:

```json
{
  "text": "사용자 로그인 기능",
  "vector": [0.231, -0.442, 0.992, 0.123]
}
```

뜻이 비슷한 문장은 벡터 거리도 가까워야 한다.

```text
Similarity(A, B) = cos(theta) = A dot B / (||A|| ||B||)
```

해석:

- 1.0: 매우 유사
- 0.8: 유사
- 0.2: 거의 무관

## 5. 벡터DB 저장(Indexing)

임베딩 결과를 벡터DB에 저장한다.

지원/후보:

- Chroma
- FAISS
- Milvus
- Qdrant
- Weaviate

저장 구조:

```json
{
  "id": "auth-login-1",
  "text": "로그인 API 설명",
  "vector": [0.2, 0.5, 0.1],
  "metadata": {
    "file": "auth.md",
    "project": "carbonet",
    "version": "2026.05",
    "menu": "회원관리",
    "permission": "ADMIN"
  }
}
```

## 6~8. 질문, 질문 임베딩, 검색

사용자 질문도 문서와 같은 방식으로 임베딩한다.

질문:

```text
표준프레임워크 로그인 API 어떻게 쓰지?
```

검색 결과 예:

- 로그인 API 설명: 0.93
- 사용자 인증: 0.88
- JWT 처리: 0.84

## 9. 재정렬(Reranking)

유사도만으로는 오탐이 생긴다.

예:

- Spring 꽃 축제
- Spring Security 로그인

둘 다 `Spring`이라는 단어를 포함하지만, 질문 의도는 `Spring Security 로그인`이다. 재정렬 모델은 질문 전체 의미를 보고 후보 순서를 다시 잡는다.

후보:

- Cross Encoder
- BGE Reranker
- Cohere Rerank

## 10~11. 프롬프트 조합과 답변 생성

최종 프롬프트에는 질문과 검색 근거를 함께 넣는다.

구성:

- 사용자 질문
- 로그인 API 설명
- 인증 모듈 설명
- JWT 예시
- 출처 경로
- 운영/배포/보안 정책

모델은 근거를 보고 답변하며, 근거가 약하면 추측하지 않아야 한다.

## 12. 로그/피드백/학습

최종 고도화 단계다.

저장:

- 질문
- 검색 문서
- 답변
- 사용자 만족도
- 관리자 승인 상태

배치:

- 잘못된 답변 추출
- 자주 묻는 질문 추출
- 신규 문서 자동 임베딩
- 승인된 항목을 LoRA 학습 데이터로 편입

## Resonance Admin Workflow

```text
관리자 페이지
     ↓
문서 업로드
     ↓
자동 정제
     ↓
자동 Chunk
     ↓
자동 임베딩
     ↓
VectorDB 저장
     ↓
RAG 검색
     ↓
40B 메인 모델 또는 14B 후보 모델
     ↓
질문 답변
     ↓
로그 저장
     ↓
관리자 승인
     ↓
LoRA 학습 데이터 편입
```

이 구조는 단순 챗봇이 아니라 사내 AI 플랫폼의 운영 흐름이다. 모델은 언제든 내리고 올릴 수 있어야 하며, 파인튜닝 모델도 shadow endpoint, benchmark, active profile, rollback alias 순서로 승격한다.
