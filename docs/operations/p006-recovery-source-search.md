# P006 복구 원본 검색 결과

2026-09-08. 서버 /opt, /var/lib, /srv, /mnt, /home, /tmp와 Windows Downloads를 검색했다. 파일 삭제, DB 생성, 데이터 복원은 하지 않았다.

## 확인 범위

서버의 PG_VERSION, dump/backup/sql.gz/sql.zst, P006 SQL 및 woosu 파일명 검색. SQL/JSON 중 woosu_digital_twin, dt_project_account 생성·적재 흔적 검색. Downloads SQL 본문에서 DB명과 계정 테이블 적재 흔적 검색 및 덤프 파일명 검색. 서버 검색은 각 시작 경로에서 -xdev 사용: 하위 다른 파일시스템 및 모든 압축파일 내부까지 검색했다는 뜻은 아니다.

## 결과

- 확인된 PostgreSQL 저장소: 기존 운영16, 개발18 클러스터. 별도 P006 저장소를 찾지 못했다.
- P006 DB 마이그레이션 SQL 3개 존재: foundation, project_sessions, telemetry_snapshot. 이것은 구조·초기값 정의이며 기존 사용자·업무 데이터 백업으로 확인된 파일이 아니다.
- Windows에서 확인된 dump 후보2개는 동일 명칭 product-selection.dump, 각9393바이트. 제품 선택용 덤프이며 P006 원본으로 확인되지 않았다.
- Downloads SQL 검색에서 woosu_digital_twin 또는 dt_project_account 적재 흔적 없음.
- USD 공장 모델·JSON·녹화 자료는 남아 있음. 이는 DB 계정·세션 데이터 대체물이 아니다.

## 판단

조사 범위 내에서 기존 P006 계정·업무 데이터를 복구할 원본을 찾지 못했다. 압축 패키지 내부·외부 전달본·다른 장치까지 없다고 단정하지 않는다. 다음에는 사용자가 별도 원본을 제공하거나, 기존 데이터 복원이 아닌 새 P006 DB 재구축을 명시적으로 선택해야 한다. 빈 DB를 만들거나 계정을 자동 생성하지 않았다.

주요 검색 도구 호출 소요 약18초(전체 대화 시간 아님). 화면 코드 변경은 없어 새 시각검수는 하지 않음.
