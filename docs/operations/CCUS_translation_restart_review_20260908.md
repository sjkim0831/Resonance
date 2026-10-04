# 번역 이벤트 로그 재증가 원인 점검

2026-09-08 약3분. 읽기전용. 파일삭제/서비스중지/DB변경0건.

대상 /opt/Resonance/var/ai-runtime/ecoinvent-shadow-translation-events.jsonl 약1.08GiB, ecoinvent-product-ko-translation-events.jsonl 약137MiB. 파일 수정시각이 현재 진행 중으로 확인됨.

서비스 resonance-ecoinvent-shadow-translation 및 resonance-ecoinvent-product-translation 모두 activating(auto-restart), Result=exit-code, ExecMainStatus=1. 관측시 systemd NRestarts는 각각120136,80431. 이 카운터는 systemd의 누적 재시작 관측값이며 전체 역사나 고유 작업 건수는 아님.

각 파일 마지막256KiB 표본: shadow1028개, product1213개 이벤트 모두 START/RUN_STARTED. 전체 파일 분포는 조사하지 않았으며 성공기록이 전혀 없다고 단정하지 않음.

ops/scripts의 두 worker에서 EVENT_LOG append 쓰기를 확인. product worker csql 함수는 kubectl cp/exec로 csql을 호출하는 과거 Kubernetes/CUBRID 연동 방식. 최근 캐시 재사용 구현은 DB조회임을 확인. 현재 실패의 정확한 예외는 이번에 확인하지 않았으므로 구형 연동 코드가 유력 문제인 점과 종료실패 증거를 구분한다.

판단: 로그만 삭제하면 현재 실패/재시작이 지속돼 재증가할 수 있다. 작업이력의 유일성 및 다른 소비자 전체 검증은 미완료. 서비스가 사용자에게 필요한 번역기능일 수 있어 임의 비활성화나 새 DB로 전환하지 않음.

권장 순서: 구형 worker2개 중지 승인→실행중지 확인→로그 보존범위 결정 및 정리→필요시 PostgreSQL기반 번역기능 별도구현/테스트. 다른 AI모델/CCUS/P006은 보호.

원씽: 파일 삭제보다 실패 반복의 원인을 먼저 끊어야 재증가를 막을 수 있다.
화면변경없음, 신규시각검수/E2E미수행.
운영: http://172.16.1.232/home
