# /opt/Resonance 추가 정리 후보

2026-09-08 실측, 약2분 읽기전용. 전체133GiB. 삭제0건.

| 경로(/opt/Resonance 기준) | 용량 | 추가 확인 사항 |
|---|---:|---|
| var/ai-runtime/ecoinvent-shadow-translation-events.jsonl | 1,161,816,007bytes 약1.08GiB | 번역 작업 이벤트 원장인지 단순로그인지, 소비자/열린파일 확인 |
| var/ai-runtime/ecoinvent-product-ko-translation-events.jsonl | 143,510,680bytes 약137MiB | 번역 재개/중복방지에 필요한지 확인 |
| runtime/platform-data/control-plane/source | 1.5GiB | 다른 소스복사본이지만 현재 실행/생성기/배포참조 여부와 고유수정 비교 필요 |
| var/ai-runtime/system-design-generator/20260904T101023Z | 329MiB | 설계/증거/복구문서가 포함돼 자동삭제 금지 |
| runtime/host-data/relocated-20260907/.gradle | 79MiB | 이동전 캐시 여부 및 현재 참조 확인 |
| runtime/host-data/relocated-20260907/.m2 | 8MiB | 고유 로컬 빌드 아티팩트 여부 확인 |
| Dockerfile 및 .dockerignore | 합2,116bytes | 컨테이너 재빌드계획/문서참조 없으면 정리후보, 용량효과는 없음 |

위 목록은 미사용 확정 목록이 아니다. 큰 항목이라도 최근 실행기록이나 고유 소스일 수 있다. control-plane/source 등을 정규 source와 이름만 비교해 삭제하면 안 된다.

보존: 개발/운영DB, 사용 AI모델, P006/Omniverse실행자산, Python의존성, 사용자선택 미확정 Kilo이력DB, 프로젝트원본, reference. .git1.4GiB도 별도요청없이 삭제하지 않음.

우선순위: 번역 이벤트파일2개(합약1.22GiB)의 쓰기/읽기방식과 보존필요성을 확인. 이후 control-plane/source1.5GiB를 실제 참조와 고유수정 기준으로 검토.
화면변경없음, 신규시각검수/E2E미수행.
원씽: 폴더 수보다 실제로 불필요한 데이터와 중복 소스를 구분하는 것이 우선이다.
운영: http://172.16.1.232/home
