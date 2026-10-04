# 캐시 및 Kilo DB 용량 검토

2026-09-08 약3분. 삭제0건, 서비스 재시작0회.

Gradle build-cache-1 약49MiB는 9월2~6일 최근 생성물이 있어 보존. .tmp 약5MiB도 최근 작업 파일이 있어 일괄 삭제하지 않음.

큰 항목: /opt/Resonance/runtime/host-data/user-local/share/kilo/kilo.db = 6,205,026,304 bytes(약5.78GiB). WAL 약21.88MiB. lsof에서 열린 파일 발견 없음. SQLite mode=ro PRAGMA만 조회하여 page_size4096, page_count1514915, freelist_count0, 반환 가능한 free page0bytes 확인. 대화 본문·계정·인증 파일은 읽지 않음.

판단: 단순 freelist 회수만으로 확보 가능한 공간은 없음. 삭제나 데이터 보존기간 정책이 필요하며 대화/작업 이력 손실 가능성이 있어 명시적 사용자 선택 없이 수행하지 않는다. VACUUM의 전체 효과를 실제 측정한 것은 아니다.

user-local/share/ov/data 약5.2GiB는 대부분 Omniverse 확장 exts/v2이고 P006 의존 가능성이 있어 보호. user-local/lib/python3.14/site-packages 약17GiB는 실제 Python 의존성으로 일괄 삭제 금지.

원씽: 큰 DB를 캐시로 오인해 지우지 않는다. 다음은 Kilo 작업 이력 보존 또는 삭제 선택이다. 계정/auth 파일은 별도이며 삭제 대상 아님.
화면 변경 없음, 신규 시각/E2E 검수 미수행.
운영: http://172.16.1.232/home
