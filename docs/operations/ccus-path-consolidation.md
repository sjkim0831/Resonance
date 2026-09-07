# CCUS 경로 통합 1차 — 2026-09-06

## 2차 실행 결과 (21:06~21:09)
아래 최신 결과가 이후의 미완료 목록보다 우선한다.

- /opt/resonance-data/dev-runtime → /opt/Resonance/runtime/host-data/dev-runtime
- config, postgresql-dev(65GB), acme, pki, tls → 같은 host-data 하위의 동명 폴더
- /home/sjkim/web-viewer-sample → host-data/web-viewer-sample
- /home/sjkim/.config/resonance → host-data/user-config
- /home/sjkim/.local/lib/resonance → host-data/user-tools
- PDF 임시 데이터 → host-data/pdf-tmp (Chromium snap의 기존 경로에 영구 bind mount)

기존 참조는 호환 심볼릭 링크 또는 bind mount로 유지한다. 실제 Java 프로세스 cwd가 canonical host-data/dev-runtime 아래임을 확인했다. 이동 및 재시작 후 24초에 백엔드 health UP, 관련 서비스 5개 active, 개발 PostgreSQL accepting connections. 실제 Chromium이 새 데이터 경로에 1페이지 PDF를 생성했다. 이는 업무 인증서 발급 E2E 증거는 아니다. 일반/관리자 비밀번호 로그인 모의 브라우저 2건 통과.

복구 증거: /opt/resonance-data/backups/path-move-20260906-210627/moves.tsv 및 path-move-20260906-210928/moves.tsv. 홈의 원본 폴더는 .before-ccus-시각 이름으로 보존했다. PDF 기존 디렉터리 내용도 bind mount 아래에 보존되어 있으며 마운트 해제 전 삭제하지 않는다. 마운트 unit과 백엔드 RequiresMountsFor drop-in은 ops/host-config/systemd에 등록했다.

### 운영 DB는 미이동
실제 운영 DB는 carbonet-prod/postgres-haproxy(10.99.213.163:5432)이며 Patroni 3개가 /opt/resonance-data/postgresql의 hostPath를 사용한다. 원본 디렉터리에 immutable 속성이 있어 rename이 Operation not permitted로 차단되었다. 보호 속성은 해제하지 않았으며 파일 이동도 발생하지 않았다. 최종 pg_isready 및 pod 확인은 sjkim의 Kubernetes context에서 수행한다. 최초 root context 점검은 localhost:8080 설정 부재로 실패한 것이며 DB 장애를 의미하지 않는다.

운영 DB 보호 해제·전환, 별도 preview 서버와 AI/외부 연계 런타임 및 과거 전달본/캐시 전체 통합은 미완료다. OS 프로그램, OS 로그, OS 등록 경로 자체는 통합 대상과 구분한다. 전체 폴더 통합 완료로 해석하면 안 된다.

## 실행 결과
프로젝트 관련 systemd 서비스·타이머·추가 설정의 실제 파일 174개를 /opt/Resonance/ops/host-config/systemd 아래로 옮기고 /etc/systemd/system의 기존 경로는 심볼릭 링크로 교체했다. 내용과 파일 모드는 원본과 같으며 상위 보관 폴더는 root 전용 700으로 제한했다. Git 제외 대상으로 지정했다. 서비스 재시작은 하지 않았고 daemon-reload만 수행했다.

3개 핵심 서비스 active, 백엔드 actuator health UP 확인. 이는 실제 로그인 및 PDF 발급 E2E 검증은 아니다. 이 단계 실행 명령 약 3.42초.

## 복구
백업 및 원본/대상 매핑: /opt/resonance-data/backups/host-config-20260906-210336/manifest.tsv
복구 시 매핑된 백업을 해당 /etc/systemd/system 경로의 링크 대신 실제 파일로 복원하고 daemon-reload한다. 비밀값이 포함될 수 있으므로 백업과 설정을 공개하거나 Git에 추가하지 않는다.

## 아직 통합하지 않은 경로
- 실행 중인 backend/TLS/config: /opt/resonance-data
- PostgreSQL dev 데이터: /opt/resonance-data/postgresql-dev/18/data (35432)
- Chromium snap PDF 임시 경로: /home/sjkim/snap/chromium/common/carbonet-pdf-tmp
- P006/Omniverse 실행 폴더: /home/sjkim/web-viewer-sample
- OS 저널과 PostgreSQL 로그: /var/log
- 사용자 홈의 전달본/덤프/구버전 파일: 실제 참조 확인 후 분류 필요

## 다음 단계
전체 이동 완료가 아니다. 실제 운영 DB 연결, 백업/복구 가능성, Chromium snap 접근 권한을 확인해야 한다. 데이터 이동과 재시작이 필요한 구성은 유지보수 시간을 확정한 뒤 순차 수행한다. /etc의 OS 등록 경로는 삭제하지 않는다. 구버전 디렉터리를 활성 소스로 대체하지 않는다.
