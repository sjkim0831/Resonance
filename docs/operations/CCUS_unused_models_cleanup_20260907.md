# 미사용 AI 모델 정리 결과 및 재사용 설계

2026-09-07 11:49~11:51 KST 점검·정리. /opt/reference는 이동·삭제·수정하지 않았다.

## 정리 결과
| 경로 | 정리 전 논리 크기 |
|---|---:|
| /opt/ollama/models/models | 11,845,495,014 bytes |
| /opt/util/ai/huggingface-laguna/hub/models--poolside--Laguna-XS-2.1-GGUF | 20,274,300,148 bytes |
| /opt/util/ai/models/Qwen2.5-7B-Instruct | 15,242,808,966 bytes |

합계 약 47.36GB. 열린 파일이 없음을 재검사하고 명시 경로 내부의 다운로드 모델·캐시만 삭제했다. Ollama 서비스 비활성 확인. 각 폴더 자체는 남겼다. 제거 시점 이후 다른 도구가 재다운로드할 가능성까지 차단한 것은 아니다.

## 보존 항목
실제로 실행 중인 resonance-shadow-gemma4-e4b, qwen05, qwen15, qwen7 서비스 및 그 모델·llama.cpp 실행 파일은 보존했다. 해당 서비스 중지나 자동 시작 설정 변경 없음. 과거 백업 /opt/opt.backup_before_cleanup_20260627 약 68GiB에는 Git 이력과 CUBRID 자료가 있어 이번에 삭제하지 않았다. 운영 DB, VM, /opt/reference, 사용자 프로젝트도 보존했다.

## 검증
정리 후 /opt 여유 236GiB, 사용률 84%. 백엔드·DB 및 4개 모델 서비스 active, backend health UP. 서비스 재시작·빌드·배포 없음. 모델 추론 API·모든 업무 E2E·브라우저 시각 검수는 수행하지 않았다. 화면·SDUI·업무 가이드·DB 스키마 변경 없음.

## 복구·재사용
삭제한 모델 바이너리는 다시 다운로드해야 한다. 작은 JSON 메타데이터 일부와 삭제 전 파일 크기·경로 목록만 보존했으므로 이것은 모델 전체 복구 백업이 아니다. 필요한 모델 버전·라이선스·다운로드 소스와 디스크 여유를 확인한 뒤 설치하고 추론 테스트를 수행한다. 실행 중인 4개 모델까지 제거하려면 소비 서비스 의존성과 자동 재기동 여부를 확인한 후 별도 중지·삭제가 필요하다.

증거 경로: /opt/Resonance/docs/operations/unused-model-cleanup-20260907
result.json, *.manifest, metadata, disk-before.txt, disk-after.txt.
