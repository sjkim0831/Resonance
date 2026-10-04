# 다운로드 DB 압축본 확인 및 이전 범위 정정

2026-09-08. 앞선 검색은 tar.gz/7z 내부를 확인하지 않아 실제 DB 압축본을 놓쳤다. 이번에는 Windows Downloads의 후보 목록과 핵심 압축본 내부를 확인했다. 데이터 복원·생성·삭제는 하지 않았다.

## 실제 존재하는 압축본

|파일|압축 크기|확인 내용|
|---|---:|---|
|carbonet_production_20260903-194310.tar.gz|775619754 bytes|carbonet_production.dump, manifest.txt, restore-list.txt, SHA256SUMS, globals.sql 포함|
|Resonance-20260903-173041.tar.gz|20758276091 bytes|전체 tar 목록 검사. 과거 CCUS 덤프6개와 P006 마이그레이션 SQL3개 확인. PG_VERSION 및 global/1262 항목 없음|
|CCUS-Resonance-full-webapp-current-20260906-v4.7z|211275255 bytes|목록에서 dump/sql.gz/PG_VERSION 일치 없음, woosu 모델 자료 확인|

DB 압축본의 restore-list.txt에서 dt_, woosu, p006을 검색했으나 일치하지 않았다. 따라서 DB 백업 자체는 존재하지만 해당 목록에서는 P006 테이블 백업을 확인할 수 없었다. 실제 전체 복원 시험·체크섬 검증은 하지 않았으며, globals.sql의 계정 비밀 내용은 출력하지 않았다.

## 이전 문서에서 확인한 근거

CCUS_DB_cutover_20260907.md: 전환 대상은 주 데이터베이스 carbonet. 개발DB 및 다른 프로젝트 DB는 이번 전환 범위에 포함하지 않는다고 명시.

CCUS_old_database_inventory_20260907.md: 구 Patroni 데이터의 global/1262 문자열에서 woosu_digital_twin 이름 발견. 물리 튜플 문자열이므로 유효 DB 존재 확정은 아니며, 로컬로 이전됐다는 증거가 없다고 명시.

CCUS_old_db_retirement_check_20260907.md: carbonet 논리 백업만으로 구 클러스터의 다른 DB까지 보존됐는지 확정할 수 없다고 기록.

## 결론과 불확실성

이벤트 테이블3개 데이터를 지웠다는 작업만으로 별도 DB가 사라졌다고 볼 수 없다. 현재 정황은 별도 P006 DB가 CCUS 로컬 이전 범위에서 누락됐을 가능성을 지지한다. 원본 삭제 시점·작업을 확인하지 못했으므로 누가 언제 삭제했는지는 단정하지 않는다. P006에 원래 데이터가 거의 없었다는 사실도 아직 입증하지 못했다.

이 PC에는 DB 압축본이 실제로 존재하며, 앞선 파일명 검색이 이를 놓친 것은 확인 부족이었다. 현재 핵심3개 압축본에서 P006 계정·업무 데이터 원본은 확인되지 않았다. 나머지 모든 압축본과 외부 전달본까지 없다는 뜻은 아니다. 가장 유력한 추가 원본은 구 Patroni 전체 클러스터 백업 또는 woosu_digital_twin 전용 덤프다. 새 DB 생성은 보류한다.
