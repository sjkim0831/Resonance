# 사용자 실행 도구 /opt 이전 설계·검증 결과

## 1. 결과
2026-09-07 11:44:52 KST 완료. 복사·전환·검증 27.14초. 사전 확인과 문서화는 별도다. /home/sjkim/.local의 실행 도구·라이브러리·연관 파일 26개 항목을 /opt/Resonance/runtime/host-data/user-local 아래의 같은 상대 경로로 이전했다. 실제 남은 용량은 약 3.6GB에서 4.6MB로 줄었다.

## 2. 경로 및 순서
1. lib/node_modules, lib/resonance.before-ccus-20260906-210928
2. share/kotlin, k9s, bash-completion, uv, pyapp, pnpm, metaflow, tirith, pipx, man, opencode, opentui, xyzservices, jupyter, doc, zsh
3. etc, testing, include, node_modules, nvim
4. package.json, package-lock.json
5. bin

기존 경로에는 심볼릭 링크를 유지했다. 라이브러리 먼저, bin 마지막 순서로 이전해 bin의 ../lib 등 상대 링크를 보존했다. 이미 이전된 Python 3.14, Kilo 기록, Omniverse 및 user-tools 링크는 재이전하지 않았다.

## 3. 안전 절차
실제 경로·링크 여부·목적지 비어 있음·열린 파일을 확인했다. rsync -aHAX로 소유권·권한·확장 속성 및 하드링크 관계를 보존해 복사하고 checksum dry-run 차이 0건을 확인한 후 기존 경로에 링크를 설치했다. 기존 폴더는 임시 보존하고 전환 후 다시 checksum 비교했다. 실행 점검과 기존에 유효했던 bin 링크 확인 후 중복 원본만 삭제했다.

## 4. 검증
- 이전 26개, 사용 중 제외 0개
- 이전 전후 체크섬·메타데이터 비교 차이 0건
- pnpm, Python 3.11, Python 3.12, Neovim 버전 명령 4개: 종료코드 0 및 이전 전후 출력 동일
- 기존 유효 실행 링크 13개: 전환 후 존재 확인
- CCUS 백엔드·DB·프론트·P006 서비스: active
- 백엔드 health: UP
- 서비스 재시작·빌드·배포 없음

각 도구의 모든 기능·API 인증·패키지 설치 전체를 테스트한 것은 아니다. 화면·DB·SDUI·업무 안내 변경 없음. 이번 파일 이전에서는 브라우저 시각 검수나 로그인·PDF 업무 E2E를 실행하지 않았다.

## 5. 남긴 항목과 용량
.local의 state 및 데스크톱 설정, keyrings, gvfs-metadata, applications, icons, xrdp 등은 합계 약 4.6MB로 소량이며 이번 실행 도구 이전 대상에서 제외했다. 이들을 불필요하다고 판단해 삭제하지 않았다. /opt 여유 195GB, 루트 여유 181GB를 최종 관측했다. 동시에 다른 작업이 공간을 사용할 수 있으므로 용량 차이를 이 작업만의 정확한 사용량으로 해석하지 않는다.

## 6. 복구·향후 운영
기존 경로 링크를 임의 삭제하거나 같은 이름의 실제 폴더를 만들지 않는다. 도구를 갱신할 때 /opt의 실제 파일과 기존 경로 링크 상태를 확인한다. 복구가 필요하면 관련 도구를 정지하고 /opt의 해당 항목을 원래 위치의 별도 임시 경로로 독립 복사·검증한 뒤 링크를 실제 폴더로 교체한다. 인증 정보나 사용자 데이터 내용은 보고서에 포함하지 않는다.

증거: /opt/Resonance/docs/operations/local-tools-relocation-20260907
- result.json, progress.json: 이전 항목 및 완료 시간
- before.json, after.json: 실행 점검 결과
- relocate-local-tools-20260907.py: 이전 스크립트 (이미 실행됐으므로 재실행 금지)
