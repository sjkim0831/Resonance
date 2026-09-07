# CCUS 사용자 실행 자원 /opt 통합 설계 및 검증

## 완료 결과
3개 항목 약 31GB 이전 완료. 전환 전후 체크섬·메타데이터 차이 0건. numpy 2.3.5, torch 2.11.0+cu130 import 결과가 전후 동일했다. 백엔드·DB·프론트·P006 서비스 active 및 백엔드 UP 확인. 서비스 재시작 없음. 루트 여유 공간 84GB, /opt 여유 공간 48GB(사용률 97%)이므로 추가 대용량 이전은 중지한다.

## 1. 목적과 범위
2026-09-07, /home/sjkim/.local의 대용량 자원 3개를 /opt 아래로 통합한다. 화면, 업무 프로세스, 권한, DB 스키마는 변경하지 않는다.

## 2. 경로 설계
| 기존 경로 | 실제 저장 경로 |
|---|---|
| /home/sjkim/.local/share/kilo | /opt/Resonance/runtime/host-data/user-local/share/kilo |
| /home/sjkim/.local/share/ov | /opt/Resonance/runtime/host-data/user-local/share/ov |
| /home/sjkim/.local/lib/python3.14 | /opt/Resonance/runtime/host-data/user-local/lib/python3.14 |

기존 경로에는 심볼릭 링크를 유지한다. 기존 프로그램의 절대 경로 및 Python 사용자 라이브러리 탐색 경로를 변경하지 않는다. Kilo 기록과 DB 파일은 삭제하거나 축약하지 않는다. 나머지 .local/bin, Node 도구, Python 별도 런타임 등은 이번 범위에 포함하지 않는다.

## 3. 전환 절차와 안전장치
1. 열린 파일 및 현재 사용 여부를 조회한다. 조회 시점 이후의 모든 접근이 없다는 보장은 아니므로 전환 직전 재검사한다.
2. 소유권, 권한, 시간, 확장 속성, 하드링크 관계를 유지하며 복사한다.
3. rsync 체크섬 및 메타데이터 비교 결과가 비어 있을 때만 전환한다.
4. 기존 폴더를 임시 보존하고 원래 경로에 새 위치 링크를 만든다.
5. 전환 후 다시 비교하며 차이가 있으면 기존 경로를 복원한다.
6. Python import 및 서비스 상태 검증 후 보존 원본에서 열린 파일이 없으면 중복 원본을 정리한다.

## 4. 검증 증거
서버 증거 디렉터리: /opt/Resonance/docs/operations/local-relocation-20260907

- started.txt / completed.txt: 실제 시작·완료 시각
- result.txt: 항목별 전환 결과
- *.diff / *.final.diff: 전환 전후 체크섬·메타데이터 차이
- python-before.txt / python-after.txt: numpy, torch import 및 버전 비교
- services.txt / health.json: 서비스 상태와 백엔드 상태
- disk-before.txt / disk-after.txt: 디스크 사용량

HTTP 응답 및 import 점검은 실제 업무 전체 E2E나 GPU 연산 검증을 대체하지 않는다. 이번 작업은 화면을 수정하지 않으며 브라우저 시각 검수는 실시하지 않는다.

## 5. 복구와 운영
필요하면 관련 도구를 정지하고 /opt 실제 폴더를 원래 경로의 독립 폴더로 복사·검증한 후 심볼릭 링크를 교체한다. 사용 중인 데이터는 과거 사본으로 되돌리지 않는다. /opt는 다른 볼륨보다 여유 용량이 적으므로 이후 대용량 이전 전에 반드시 잔여 공간을 확인한다. 소스 저장소 내부의 runtime/host-data는 실행 데이터이며 Git 커밋이나 소스 배포 압축에 무조건 포함하지 않는다.
