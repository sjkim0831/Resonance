# Resonance 병렬 작업 구조 설계 및 사용 안내

1. 대상: sjkim@172.16.1.232의 `/opt/Resonance`. 2026-09-30 작업. 운영 서비스가 아닌 개발 도구 개선.
2. 목적: 여러 작업자가 현재 개발본을 기준으로 독립 작업하고 변경 충돌을 통합 전에 확인.
3. 구현: `/opt/Resonance/ops/parallel-guard/parallel_guard.py`. Python 표준 라이브러리만 사용. 기본 검증 동시 실행 수 4개.
4. 구조: `설계 manifest → 범위 충돌 검사 → 현재 파일 snapshot → 작업별 candidate → 통합 candidate → 검증 report`.
5. 원씽: 모든 작업의 읽기/쓰기 범위를 작업 시작 전에 선언한다.
6. 깨달음: 작업자 수보다 공유 파일·입출력 계약·통합 순서가 병렬화 품질을 좌우한다.

## 실제 확인한 기존 구조

- 정식 소스는 `/opt/Resonance`. 소문자 `/opt/resonance`는 존재하지 않음.
- 점검 시 Git tracked 상태: 수정 985개, 삭제 32,359개. 신규 미추적 파일은 이 집계에서 제외.
- `/opt` 볼륨 약 1.6TB, 사용 167GB, 여유 1.3TB, 사용률 12% (`df -h` 표시 기준).
- 기존 `ops/ai-agent-orchestrator`에 worktree/file-lease 구현과 worker slot 4개 설정이 있음.
- 기존 worktree 사전 검사에는 정식 저장소의 미커밋 변경 차단이 있음. 이번 도구는 Git HEAD 대신 선언된 현재 파일을 snapshot으로 복사함.
- 기존 도구를 수정하거나 교체하지 않고 독립 CLI를 추가함. 기존 worker 호출부와 자동 연결되지는 않음.

## 설계 계약

|항목|동작|
|작업 소유권|`writes`는 파일 또는 디렉터리의 명시적 상대 경로. glob 미지원|
|읽기 의존성|`reads`에 필요한 파일/디렉터리 선언|
|충돌|작업 간 write/write 또는 write/read 경로 중첩이면 시작 전 실패|
|공통 계약 변경|동일 라운드에서 다른 작업이 읽는 계약은 수정 금지. 별도 선행 라운드 후 새 snapshot|
|원본 기준|현재 파일 bytes SHA-256, mode, size 저장. 준비 전후 및 검증 전후 재확인|
|격리|작업별 전체 선언 범위의 파일 복사본. 작업 외 변경은 통합 거부|
|신규·삭제|범위 안 신규/삭제 파일도 통합 후보에 반영|
|통합|단일 실행 lock을 사용. 운영 파일 쓰기·Git commit·push·deploy 기능 없음|
|검증|각 작업 checks를 최대 4개 동시 실행하고 성공 후 integration_checks 실행|
|실패 복구|원본 유지, 로그 보존, 기존 PASS 무효화. 원본 변경이면 새 run으로 재준비|
|확장|manifest의 workers 1~32. 실제 작업별 메모리/CPU를 측정해 조정|

## 실행 방법

```bash
cd /opt/Resonance
python3 ops/parallel-guard/parallel_guard.py plan /path/to/plan.json
python3 ops/parallel-guard/parallel_guard.py prepare /path/to/plan.json \
  --root /opt/Resonance --run /opt/Resonance/var/parallel-guard/my-new-run
# 각 작업자는 my-new-run/tasks/<id>/ 아래에서 선언한 writes만 수정
python3 ops/parallel-guard/parallel_guard.py verify \
  --run /opt/Resonance/var/parallel-guard/my-new-run --timeout 60
```

`report.json`의 `status=PASS`, 작업별 변경 파일, 검증 exit code와 시간, 통합 candidate 경로를 검토한다.
PASS는 선언한 검증 명령의 성공만 의미한다. 업무 완결성이나 무오류를 보장하지 않는다.
통합 후보의 운영 반영은 기존 변경·배포 절차에서 별도로 수행해야 한다. 이 도구로 운영 반영하지 않는다.

```json
{
  "workers": 4,
  "tasks": [
    {
      "id": "screen-a",
      "writes": ["design/screens/a.json"],
      "reads": ["design/contracts/common.json", "tools/validate_screen.py"],
      "checks": [["python3", "tools/validate_screen.py", "design/screens/a.json"]]
    },
    {
      "id": "screen-b",
      "writes": ["design/screens/b.json"],
      "reads": ["design/contracts/common.json", "tools/validate_screen.py"],
      "checks": [["python3", "tools/validate_screen.py", "design/screens/b.json"]]
    }
  ],
  "integration_checks": [["python3", "tools/validate_screen.py", "design/screens"]]
}
```

위 경로는 형식 예시이다. 실제 존재하는 검증 프로그램과 설계 경로로 채워야 한다.

## 안전 경계와 한계

1. 파일 복사는 보안 sandbox가 아니다. 신뢰하는 작업자와 검증 명령만 사용한다. subprocess는 OS 계정 권한을 가진다.
2. symlink·경로 탈출·`.git`·`.secrets` 경로는 거부한다. 자격증명 폴더를 reads/writes로 선언하지 않는다.
3. 쓰기 범위는 사전 예약 시스템 전체에 강제되는 전역 lock이 아니다. 다른 세션은 가능하며 원본 drift 검사로 통합을 거부한다.
4. checks는 복사된 파일을 변경하면 실패한다. 빌드 캐시·테스트 출력은 별도 임시 경로로 둔다.
5. 검증 이후 원본이 바뀔 수 있으므로 후속 반영 도구도 baseline을 재검사해야 한다. 현재 자동 반영은 구현하지 않는다.
6. 후보·실패 로그는 보존한다. 자동 삭제하지 않는다. run별 실제 용량을 확인하고 보존 정책에 따라 정리한다.
7. 프로세스·화면·권한·API·DB를 연결하는 ID 설계는 후속 확장 사항이다. 이번 구현은 그 작업을 병렬로 검증할 기반이다.
8. 페이지 E2E·KRDS 준수·계정 릴레이·실제 백엔드 업무 완료는 이번 도구 테스트에서 검증하지 않았다.
9. E4B 등 모델과 독립적인 CLI다. E4B 실제 생성 품질이나 10분 전체 검증·1분 배포는 아직 측정하지 않았다.

## 다음 작업 카드

- 담당: 프레임워크 개발 담당자. 위치: 정식 소스와 새 candidate 작업 공간.
- 지금 할 일: 실제 업무 1개에서 서로 충돌하지 않는 4개 작업 범위를 선정하고 manifest 작성.
- 필요한 전체 항목: 업무명, 프로세스 ID, 작업 ID, 담당 액터, 쓰기 경로, 읽기 계약, 실제 검증 명령, 통합 검증 명령, 실행 제한시간, 테스트 계정 참조, 입력값, 기대 출력, 증거 저장 위치.
- 순서: 공통 계약 확정 → 작업별 수정 → 페이지 검증 → 계정 릴레이 프로세스 검증 → 통합 검증 → 별도 운영 반영.
- 도움말·전체 업무 보기·설계·QA 카드는 이번 개발 도구 문서에 통합했다. 기존 서비스의 화면 카드를 수정한 것은 아니다.

## 비용·성능 산정

- 추가 패키지 설치 0개, 유료 외부 API 호출 0회, 전체 애플리케이션 빌드 0회, 서비스 배포·재시작 0회.
- 이번 도구로 발생시킨 별도 외부 API 구매비 0원. 기존 서버·전력·Codex 비용은 단가와 사용량이 없어 산정하지 않음.
- 준비 시 공간 추정: 선언 파일 bytes 합계 × (작업 수 + 2). 검증 후보를 재생성하면 추가 공간 사용. 매 준비 시 여유 공간 검사.
- 공격력은 동시 검증 작업 수로, 방어력은 자동화 회귀 테스트 통과 수로 표현한다. 주관적인 종합 점수는 만들지 않는다.
