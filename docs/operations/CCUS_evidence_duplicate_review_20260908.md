# 검증 산출물 중복 및 임시 파일 검토

2026-09-08, 약2분. /opt/Resonance/var/test-evidence의 실제 파일을 크기와 SHA256으로 비교.

- 내용 중복138그룹, 경로별 중복 논리량48,973,039바이트(약46.7MiB).
- manifest.json, contracts.jsonl, quality-report.json 등이 서로 다른 검증 실행 디렉터리에 반복됨.
- 개별 실행 기록은 각 디렉터리 상대 경로로 읽힐 수 있으므로 내용 동일만으로 파일을 삭제하지 않음. 하드링크 공유 역시 후속 쓰기가 다른 실행 기록에 영향을 줄 수 있어 미적용.
- 중복 검증 결과 삭제0건. 목록은 evidence-duplicates.json.

## 삭제

/opt/Resonance/runtime/build-candidates/typecheck.tsbuildinfo 1파일709,884바이트 삭제.
현재 빌드 스크립트 ccus-build-current.sh의 tsc --incremental --tsBuildInfoFile로 다시 생성되는 타입검사 캐시. 열린 파일 없음과 정규 경로/하드링크 확인 후 삭제. 다음 타입검사에서 초기 재계산 비용이 발생할 수 있음. 소스, 최신 실행본, 빌드 영수증 및 스크린샷은 보존.

## 검증

서비스5개 active, 홈 HTTP200/페이지 오류0건, 스크린샷 확인. 재시작0회. 실제 재빌드 및 전체 E2E는 미실행.
이 결과는 큰 용량 절감이 아님. 반복적으로 재생성되는 빌드 캐시를 지우는 것은 상시 정리 대상으로 적절하지 않으므로 다음은 대용량 미사용 폴더 검토를 우선한다.
