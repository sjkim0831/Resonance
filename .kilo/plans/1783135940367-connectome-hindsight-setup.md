# Connectome (Hindsight Memory) 적용 계획

## 목표

Hermes에 Knowledge Graph 기반의 Connectome 메모리 시스템(Hindsight)을 적용하여 개체 간 관계 추론 가능하게 하기

## 현재 상태

- Hermes: 설치済み (소스 경로: `/opt/Resonance/modules/hermes-core`)
- Hindsight 플러그인: 설치済み
- hindsight-client: **미설치**
- 메모리 프로바이더: `provider: ''` (미설정)

## 모델 정보

- **40B opus 모델**: `qwen3.6-40b-deck-opus-q4`
- **vLLM 엔드포인트**: `http://127.0.0.1:24036/v1`
- Hindsight Local Embedded 모드에서 이 모델 사용

## 실행 단계

### 1. Hindsight 설치

```bash
pip install hindsight-all
```

Local Embedded 모드에서는 `hindsight-all` 패키지가 필요합니다 (~200MB).

### 2. PYTHONPATH 영구 설정

```bash
echo 'export PYTHONPATH=/opt/Resonance/modules/hermes-core:$PYTHONPATH' >> ~/.bashrc
source ~/.bashrc
```

### 3. 메모리 프로바이더 설정

```bash
hermes config set memory.provider hindsight
```

### 4. Hindsight 설정 파일 생성

```bash
mkdir -p ~/.hermes/hindsight

cat > ~/.hermes/hindsight/config.json << 'EOF'
{
  "mode": "local_embedded",
  "llm_provider": "openai_compatible",
  "llm_base_url": "http://127.0.0.1:24036/v1",
  "llm_model": "qwen3.6-40b-deck-opus-q4",
  "bank_id": "resonance-connectome",
  "bank_mission": "Resonance 프로젝트의 개체와 관계를 그래프로 구축",
  "recall_budget": "high",
  "memory_mode": "hybrid",
  "auto_recall": true,
  "auto_retain": true,
  "retain_every_n_turns": 1
}
EOF
```

### 5. Hermes 재시작 및 검증

```bash
# PYTHONPATH 설정 후 실행
cd /opt/Resonance/modules/hermes-core
PYTHONPATH=/opt/Resonance/modules/hermes-core hermes memory status

# Provider가 "hindsight"로 표시되는지 확인
```

## 검증

- `hermes memory status` → Provider가 `hindsight`로 표시
- Hermes 대화 중 `hindsight_retain`, `hindsight_recall`, `hindsight_reflect` 도구 사용 가능

## 참고

- Local Embedded 모드는 로컬 vLLM의 40B 모델 사용 (API 키 불필요)
- 기존 Hermes 세션은 재시작 필요
- Daemon은 자동 시작되며 5분 비활성 후 자동 종료