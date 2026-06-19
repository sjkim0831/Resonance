# Ubuntu 속도 최적화 플랜

## 현재 시스템 상태

| 항목 | 현재값 | 평가 |
|------|--------|------|
| 메모리 | 60Gi 중 18Gi 사용 (30%) | 충분 |
| CPU 부하 | 3.85 (32코어) | 낮음 |
| swappiness | 10 | 적절 |
| I/O 스케줄러 | mq-deadline (NVMe SSD) | 적절 |
| CPU 거버너 | performance | ✅ 적용됨 |

## 적용 완료 상태

✅ 2026-06-16 적용 완료

### 중지된 서비스:
1. `unattended-upgrades.service`
2. `snap.cups.cups-browsed.service`
3. `snap.cups.cupsd.service`
4. `ModemManager.service`

### 비활성화된 타이머:
- `motd-news.timer`
- `update-notifier-download.timer`
- `update-notifier-motd.timer`
- `apport-autoreport.timer`

### 변경된 설정:
- CPU 거버너: `powersave` → `performance`
- SSH: `/home/sjkim/.ssh/authorized_keys`에 키 1개 추가

### 미완료 (선택사항):
- ~~APT 자동 업데이트 비활성화~~: ✅ 완료

## 예상 효과

- 메모리: 15~30MB 절약
- CPU: 서비스 관리 오버헤드 감소, 퍼포먼스 모드로 최대 클럭 유지
- 부팅 시간: 일부 개선