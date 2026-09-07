# /opt 외 경로 정리 설계·검토·검증

## 1. 범위와 기준
2026-09-07 서버 172.16.1.232의 루트 파일시스템, /home, /root, /var, /tmp를 용량 기준으로 조사했다. 모든 파일의 의미를 판정한 전수 기능 감사는 아니다. 운영체제 파일, 사용자 작업물, 비밀정보, DB, 서비스 데이터, 복구 자료, 이전 /opt 링크는 삭제하지 않는다.

삭제 조건은 재생성 가능한 캐시이며 경로가 명시적 허용 목록에 포함되고 심볼릭 링크가 아니며 조회 시점에 열린 파일이 없는 경우이다. 열린 파일 조회는 미래의 접근까지 보장하지 않으므로 운영 데이터에는 이 기준만으로 삭제를 적용하지 않는다.

## 2. 삭제 완료
| 경로 | 내용 |
|---|---|
| /root/.npm/_cacache | npm 다운로드 캐시 |
| /root/.cache/pip | root pip 다운로드 캐시 |
| /home/sjkim/.cache/pip | 사용자 pip 다운로드 캐시 |
| /home/sjkim/.cache/node-gyp | 재생성 가능한 Node 빌드 헤더 캐시 |
| /tmp/node-compile-cache | Node 컴파일 캐시 |

각 폴더 자체는 유지하고 내부 캐시만 정리했다. 패키지 설치본, 사용자 설정, 로그인 정보는 삭제하지 않았다. 필요 시 다음 패키지 설치·실행 과정에서 캐시를 다시 생성하며 최초 실행·다운로드 시간은 늘어날 수 있다. 오프라인 설치에서는 패키지 캐시 재다운로드가 불가능할 수 있으므로 네트워크 연결을 확인한다.

## 3. 주요 보존 항목
| 경로/종류 | 관측 용량 | 보존 사유 |
|---|---:|---|
| /var/lib/docker | 95GB | Docker 실행 중. 컨테이너·볼륨·이미지별 의존성 조사 없이 삭제 금지 |
| /var/lib/registry | 3.4GB | 이미지 저장소 데이터. 사용·복구 의존성 미확정 |
| /var/lib/etcd, /var/lib/kubelet | 약 642MB | Kubernetes 실행 상태 및 클러스터 데이터 |
| /var/cache/netdata | 2.3GB | 실행 중인 모니터링 서비스 데이터 |
| /var/log | 4.4GB | 감사·장애 분석 기록. 보존 정책 확인 필요 |
| /tmp/carbonet-request-execution-history.jsonl | 약 3.9GB | 업무 실행 이력. 임시 경로라도 업무 자료이므로 보존 |
| /tmp/member-process-recovery 및 선택복구 자료 | 약 2.7GB 이상 | 사용자가 요청했던 복원·설계 자료. 중복 검증 전 보존 |
| /home/sjkim/OmniverseProjects | 2.6GB | 사용자 프로젝트 |
| /home/sjkim/kit-app-template | 2.2GB | 실행·개발 프로젝트 가능성 |
| .codex, .hermes, .kilo-homes, .config, .ssh | 개별 크기 상이 | 기록·설정·인증 정보 |
| /usr, /etc, /boot, /run 및 시스템 경로 | 개별 크기 상이 | 운영체제 구성 요소 |

## 4. 테스트 및 증거
증거: /opt/Resonance/docs/operations/outside-opt-cleanup-20260907

- *.manifest: 삭제 전 파일 경로·크기·수정시각. 파일 내용이나 자격증명은 수집하지 않음.
- deleted.txt: 정리 항목과 실행 결과
- disk-before.txt / disk-after.txt: 실제 공간 변화
- services.txt: CCUS 백엔드·DB·프론트·P006·Docker·containerd·kubelet active
- health.json: 백엔드 UP
- http.txt: 홈 및 P006 HTTP 200
- started.txt / completed.txt: 실행 시각

서비스 재시작·빌드·배포 없음. 화면·SDUI·업무 가이드·권한·DB 설계 변경 없음. 브라우저 시각 검수 및 로그인/PDF 업무 E2E는 이번 정리에서 실행하지 않았으며 HTTP 200으로 이를 대체해 성공 주장하지 않는다.

## 5. 다음 단계
/opt 밖의 공간과 /opt 공간은 별도 볼륨이므로 이번 정리는 /opt 부족을 해결하지 않는다. Docker 95GB를 줄이려면 실행 중 컨테이너와 볼륨의 사용 관계를 먼저 확정하고 삭제 후보를 개별 승인 대상으로 만든다. 사용자 프로젝트와 과거 업무 이력은 불필요하다고 추정해 삭제하지 않는다.
