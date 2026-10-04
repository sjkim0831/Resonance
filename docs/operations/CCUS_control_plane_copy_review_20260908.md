# control-plane/source 중복 여부 검토

2026-09-08 약2분. 대상 /opt/Resonance/runtime/platform-data/control-plane/source 약1.5GiB. 삭제0건/서비스변경0회.

같은 상대경로의 /opt/Resonance 현재 파일과 크기+SHA256 비교:
- 동일17,183파일 / 552,817,194bytes 약527MiB.
- 상이1,514파일 / 221,013,230bytes 약211MiB.
- 현재 동일경로에 없음24,322파일 / 622,050,156bytes 약593MiB.
- 현재경로가 symlink7파일은 내용 동일 판정에서 제외.

비교는 .kube/.secrets/.git/runtime/var와 원본측 symlink를 제외했다. 고유파일은 현재 같은경로에 없다는 뜻이며 다른 위치에도 없다는 의미가 아니다. 고유변경이 최신 또는 필요한 변경이라고 단정하지 않는다.

상이 예시 settings.gradle.kts, docs_ai.py. 복사본에만 존재하는 예시 deploy/deploy-resonance-k8s.sh 및 ai-builder/output/frontend의 생성화면 코드. 전체 폴더는 완전중복본이 아니다.

systemd/cron.d/ops/scripts/scripts의 control-plane/source 및 CONTROL_PLANE 참조 검색과 lsof에서 사용 발견 없음. 동적경로·다른소스의 참조까지 배제한 것은 아님. 따라서 통째 삭제하지 않았다. 동일파일만 부분삭제해 복사본 구조를 깨뜨리는 것도 진행하지 않았다.

다음: 사용자가 이 과거소스 복사본 자체를 폐기할지 선택하거나, 고유생성물의 다른위치 중복/현재기능 연관을 더 검증한다. 번역서비스 중지/로그삭제는 별도확인 대기.
원씽: 과거복사본처럼 보여도 고유코드가 있으면 중복이라고 단정하지 않는다.
화면변경없음, 신규시각검수/E2E미수행.
운영: http://172.16.1.232/home
