# CCUS 서버 경로·운영 정돈 기준

2026-09-07 12:05 KST 기준. 이 문서는 경로를 찾고 안전하게 유지하기 위한 운영 설계이며, 아래 폴더를 삭제 대상으로 지정하는 문서가 아니다.

## 1. 변경 금지 및 핵심 경로
| 용도 | 실제 경로 | 관리 원칙 |
|---|---|---|
| 참고 원본 | /opt/reference | 사용자 지정 보호. 이동·삭제·수정 금지 |
| 표준 소스 | /opt/Resonance | 현재 소스 기준. 원격 main과 별도 보존 브랜치 구분 |
| 개발 프론트 | /opt/Resonance/projects/carbonet-frontend/source | 실행 중인 Vite 소스. 이전 worktree로 대체 금지 |
| 네이티브 운영 DB | /opt/ccus-postgresql16 | 운영 데이터. 일반 용량 정리 대상 아님 |
| DB·업무 자료 | /opt/resonance-data | 모든 하위 경로를 캐시나 백업으로 간주하지 않음 |
| 사설 이미지 저장소 | /opt/registry/data | Docker bind mount. 현재 사용 이미지 보존 |
| 사용 모델·실행 도구 | /opt/util/ai | 사용 중인 Gemma·Qwen 및 실행 라이브러리 보존 |
| 사용자 도구 실제 위치 | /opt/Resonance/runtime/host-data | /home 및 /root 링크 유지 |
| 호스트 설정 | /opt/Resonance/ops/host-config | /etc/systemd 연결 관계 유지 |
| 유지보수 완료 스크립트 | /opt/Resonance/ops/maintenance/archive/20260907 | 증거용. 이미 실행한 삭제·이전 스크립트 재실행 금지 |
| 운영 문서·증거 | /opt/Resonance/docs/operations | 날짜·작업별 이력 조회 |

## 2. 이번 정돈 결과
- /tmp의 이번 작업 스크립트 16개를 관리 폴더로 복사·해시 비교한 뒤 기존 임시 파일을 제거했다.
- 실패 상태 65개 중 종료된 transient 배포 재시도 30개의 상태 기록을 먼저 보존하고 reset-failed했다. 일회성 실패 표시를 정리한 것이며 배포 오류를 고쳤다는 의미가 아니다. 실패 35개는 숨기지 않고 남겼다.
- 서비스 정지·재시작·자동 배포·자동 설계 동기화는 수행하지 않았다.
- /opt/reference와 운영 소스·DB·모델·새 패키지 검증 폴더는 이동·삭제하지 않았다.

## 3. 이미 완료한 주요 정리
1. 사용자 도구·캐시·이전 자료를 /opt로 이전하고 기존 경로를 심볼릭 링크로 유지.
2. 사설 이미지 저장소를 필요한 데이터 약 10.35GB로 선별하고 /opt/registry/data로 전환.
3. PostgreSQL 원본·미러 46쌍을 하드링크 통합. 독립 사본이 아니라는 점을 복구 시 확인.
4. 미사용 AI 모델 다운로드 3곳 정리. 사용 중인 모델은 유지.
5. 소스 보존 커밋 3e7f565016e500996a67c12387c00c642fc2c5c5를 backup/ccus-opt-cleanup-20260907에 푸시.
6. 승인된 2026-06-27 과거 Git·CUBRID·AI 백업 폴더 삭제.

## 4. 남은 검토 항목
전체 서버가 무오류 또는 모든 불필요 파일이 제거된 상태는 아니다.

- 실제 실패 상태 35개: 알림 수집, 백업 복원 훈련, P006 route guard, CA 검증, 야간 화면 검증, 40B 추론 서비스 등. 각 원인과 현재 필요성을 판정해야 한다.
- /opt/containerd, /var/lib/etcd, /var/lib/registry, VM 디스크, 사용자 Omniverse 프로젝트는 별도 의존성 확인 전 보존.
- 홈페이지 40B 실제 endpoint·model ID 확인 필요. 봇 서비스 실행만으로 모델 추론 성공을 판정하지 않는다.
- Git main과 보존 브랜치의 이력 차이 및 커밋에서 제외된 변경 검토 필요.
- 제품 선택 미출력 문제는 별도 화면/API/DB 진단 필요.

## 5. 용량과 검증
루트: 여유 181GiB, 사용률 36%. /opt: 여유 290GiB, 사용률 81%.
핵심 서비스 9개의 상태·PID·작업 경로를 저장했다. 백엔드 health UP, 홈 HTTP 200, 레지스트리 API HTTP 200 확인. 이것은 로그인·PDF·AI 추론·모든 화면의 E2E와 동일하지 않다. 브라우저 시각 검수는 이번 운영 정돈에서 실행하지 않았다. 화면·도움말·업무 길잡이·SDUI·DB 스키마 변경 없음.

## 6. 재발 방지 운영 규칙
- 새 프로젝트 실행 자원은 /opt 아래 지정 경로를 사용하고 기존 경로에 실제 폴더를 재생성하지 않는다.
- 모델·백업·DB·node_modules·실행 증거 전체를 Git에 무조건 추가하지 않는다.
- 과거 실패 서비스를 전체 재시작하지 않는다. 특히 이전 설계 동기화·자동 배포 경로를 재활성화하지 않는다.
- 하드링크 백업은 직접 덮어쓰지 않고, 새 파일에 쓰고 rename한다. 복구는 독립 복사본에서 수행한다.
- 자동 삭제 작업은 이번에 추가하지 않았다. 보존 정책과 외부 독립 백업이 정해진 뒤 별도 구성한다.

증거: /opt/Resonance/docs/operations/server-organization-20260907/result.json, services.json, failed-before.json, failed-remaining-names.txt
