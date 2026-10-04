# 과거 소스 복사본의 다른 경로 중복 검토

2026-09-08 약2분. /opt/Resonance/runtime/platform-data/control-plane/source의 현재 동일경로에 없는 파일을 현재 소스 루트 및 canonical backend runtime과 크기/SHA256 대조. 삭제0건, 서비스변경0회.

대조24,290개: 다른경로에서 동일파일2,970개/97,628,709bytes(약93.1MiB), 이번검색에서 미일치21,320개/524,292,891bytes(약500MiB).

이전24,322개와 차이32개는 이번검사에서 계정도구 폴더/환경파일 등 제외규칙을 강화했기 때문이다. .git/.kube/.secrets/.kilo/.codex/.hermes/.ssh/node_modules/__pycache__ 및 환경/인증파일은 제외. runtime/var는 복사본 후보에서 제외. 전체 서버의 모든 경로를 검사한 결과는 아니다.

현재 다른위치와 일치 예: OCR eng/kor traineddata.gz, runtime/catalog.json, generatedScreenCatalog.ts.

큰 미일치파일 예: Backstage backend dist/bundle.tar.gz 약14.7MiB; Backstage frontend .js.map 다수; 과거 GeneratedScreenPage-C1z8EXUK.js 약4.75MiB 3개경로; Yarn install-state.gz 및 배포파일. 미일치가 고유 수작업 원본이라는 의미는 아니다.

판단: 통째복사본삭제는 아직 보류. 다음은 generated/dist/build/static-assets 등 과거산출물과 실제소스/설계를 분리하고, 실제실행·참조·복구필요 여부를 확인한 뒤 폴더단위 삭제범위를 결정한다. 일치파일만 무작정 지워 복사본을 불완전하게 만드는 방식도 미실행.

원씽: 현재같은경로에 없다는 이유만으로 고유원본이라고 간주하지 않고, 내용해시와 파일역할을 함께 확인한다.
시각검수/E2E미수행(파일읽기만 진행).
운영: http://172.16.1.232/home
