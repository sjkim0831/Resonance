# 잔여 정리 우선순위 재검토

2026-09-08 약2분 읽기전용, 삭제0건, 서비스변경0회. /opt/Resonance 약133GiB.

추가 발견: runtime/platform-data/control-plane/source/projects/carbonet-assets/static/react-app/assets 약378MiB. 이름해시가다른동일컴포넌트번들이여러개존재하지만, 해시가다른이름만으로내용중복/미사용을판정할수없다. source map파일은0개. HTML/JS동적import의참조그래프와현재별도배포연결을확인하기전에는폴더삭제하지않음.

더우선인운영문제: 구형번역서비스2개가계속auto-restart중. 관측NRestarts product80465/shadow120187. 실패로그약1.22GiB는계속쌓일수있다. 중지/비활성화승인이없어변경안함.

대용량보존선택대기: Kilo작업이력약5.8GiB, 과거control-plane/source약1.2GiB의고유소스. 개발/운영DB및사용모델은삭제대상아님.

원씽: 재시작루프를방치한채작은캐시삭제를반복하는것보다, 필요한서비스인지결정하는것이우선이다.
다음선택: 구형번역서비스2개를중지해실패반복을멈출지확인. PostgreSQL연동복구는별도개발범위.
화면변경없음, 신규시각/E2E검수미수행.
운영: http://172.16.1.232/home
