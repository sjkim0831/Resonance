# 남은 실행 의존성 및 시스템 저널 정리 검토

2026-09-08 약3분. 추가 확보0bytes. 서비스 재시작0회.

Python3.14 site-packages17GiB의 큰 항목: nvidia3GiB, flashinfer_cubin1.5GiB, torch1.2GiB, triton641MiB, vllm608MiB. AI 실행 의존성이므로 사용 모델 보호 조건에 따라 임의 삭제하지 않았다. 개별 패키지의 실제 import 사용률은 조사하지 않았다.

/var/log/journal은 /opt/Resonance/runtime/host-system/storage/var-log-journal에 bind mount돼 있다. du약787MiB와 journalctl522.3MiB는 집계 범위가 다르다. netdata별도 디렉터리 포함 여부가 있으므로 차이를 삭제 가능 공간으로 간주하지 않았다.

정확한 /opt 저널 경로에 journalctl --vacuum-time=30d 실행. 표준 기능이 식별한 오래된 보관 저널의 회수0B. 임의로 보존기간을 줄이거나 활성 저널을 회전/삭제하지 않았다. 영구 retention설정 변경없음.

검증: journald 및 기존5개서비스 총6개active, 홈HTTP200. 신규 화면변경없음. 브라우저시각검수/로그인/PDF E2E미수행.

판단: 이번 후보에는 안전하게 더 지울 대용량 항목을 확인하지 못했다. 미사용확인 없는 라이브러리 및 최근로그 삭제를 진행하지 않는다. Kilo이력DB 등 사용자데이터 보존선택은 별도다.
원씽: 삭제량을 늘리기 위해 실행 의존성과 최근 진단기록을 희생하지 않는다.
운영: http://172.16.1.232/home
