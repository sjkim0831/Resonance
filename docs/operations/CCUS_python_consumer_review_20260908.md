# Python 공유 환경 사용처 검토

2026-09-08, 약 2분. 삭제/이동/서비스 변경 0건.

대상 설치본: /opt/Resonance/runtime/host-data/user-local/lib/python3.14/site-packages, 약17GiB.
실제 사용자 사이트 경로 /home/sjkim/.local/lib/python3.14/site-packages가 해당 설치본으로 연결됨. python3는 /usr/bin/python3, 버전3.14.4. 사용자 패키지 로딩 활성화.

## 분석 범위

ops, scripts, projects/P006, runtime/host-data/web-viewer-sample의 Python 소스100개를 AST 파싱. 오류0건. node_modules/.git/venv/생성 폴더는 제외. 패키지 코드를 실행하지 않고 설치 메타정보1,268종과 최상위 import 비교.
직접 참조가 연결된 배포 패키지는7종. 나머지1,261종은 미사용이 아니라 미확정임. 동적 import, 전이 의존성, 서비스 이외 CLI/AI 환경 사용은 이 분석만으로 확인되지 않음. top_level.txt 없는 패키지는 이름 기반 추정으로 누락 가능.

## 판단 및 위치 정책

이 환경은 실제 Python 기본 사용자 검색 경로이므로 .py/.so 라이브러리를 도구별 폴더로 개별 이동하면 안 됨. 현 위치를 공통 Python 사용자 환경으로 분류해 유지. 패키지 제거는 실제 소비자와 전이 의존성 확인 후 패키지 관리자 단위로 처리할 것.
사용처 검색에 안 잡혔다는 이유로 GPU 라이브러리나1261종 패키지를 일괄 삭제하지 않음. 설치 환경 전체 이동도 기본 검색 경로와 업데이트 정책을 함께 바꿔야 하므로 이번 미실행.

## 산출물 및 다음

packages.csv: 설치1268종 이름/버전/의존성/정적 참조/판정.
imports.csv:100개 소스의 최상위 import와 소스 경로.
summary.json: 범위/오류/사용자 사이트 정보.
다음은 Python 공유 환경을 유지한 채 남은 역할 미확정 폴더로 정리 대상을 옮기는 것. 이번 읽기 전용 파일 분석이므로 신규 화면 검수 및 전체 E2E 미실행.
