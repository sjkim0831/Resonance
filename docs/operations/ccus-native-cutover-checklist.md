# 운영 전환 게이트 (자동 적용 금지)

1. carbonet.dump 완료 및 SHA256 검증. partial 파일은 사용 금지.
2. 후보 전체 복원 성공 로그와 테이블/시퀀스/제약/인덱스/권한 검증.
3. 원본 자동 쓰기 작업과 사용자 입력 중단 계획: Java 앱, Keycloak identity sync, 디자인 release/asset worker, 기타 SQL 스크립트. 타이머 이름만으로 중단/삭제 대상을 추정하지 않는다.
4. 최초 백업 이후 변경분 일관 동기화 또는 쓰기 중단 후 최종 백업·재복원. 현 백업은 시험 복원용으로 운영 전환 근거가 아니다.
5. 다른 DB carbonet_production, resonance_p004, resonance_p005, woosu_digital_twin, keycloak, backstage_* 의 소비자와 이전 필요 여부 검증. 이들 잔존 시 Kubernetes 전체 삭제 금지.
6. 127.0.0.1:35433으로 후보 앱 연결 시험. 로그인/권한/메뉴/PDF 발급/진위확인 검증. 임의로 사용자 인증을 우회하거나 테스트 결과를 실제 E2E로 표기하지 않는다.
7. native-db-cutover.conf를 systemd drop-in으로 설치하고 환경파일 우선순위를 확인. 기존 DB 비밀번호를 노출하거나 새 비밀번호로 변경하지 않는다.
8. 재시작 후 Java 실제 TCP 접속이 127.0.0.1:35433인지 확인. DB 서비스 부팅 활성화 후 정상 동작 검증. 실패 시 drop-in을 제거하고 이전 DB로 복구.
9. 구 DB/볼륨 삭제는 복구 보존기간과 사용자 확인 이후에만 수행.

준비된 native-db-runtime.env와 native-db-cutover.conf는 아직 운영 서비스에 연결하지 않았다.
