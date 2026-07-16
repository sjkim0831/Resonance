# 전체 프로세스 가로 순서도

> Mermaid 입력용 자동 생성 파일입니다. 각 프로세스는 왼쪽에서 오른쪽으로 진행됩니다.

## 회원가입·본인확인

```mermaid
flowchart LR
  START_IDENTITY_SIGNUP([시작])
  START_IDENTITY_SIGNUP --> IDENTITY_SIGNUP_01_회원유형_선택["회원유형 선택"]
  IDENTITY_SIGNUP_01_회원유형_선택 --> IDENTITY_SIGNUP_02_약관_개인정보_동의["약관·개인정보 동의"]
  IDENTITY_SIGNUP_02_약관_개인정보_동의 --> IDENTITY_SIGNUP_03_본인_법인_인증["본인·법인 인증"]
  IDENTITY_SIGNUP_03_본인_법인_인증 --> IDENTITY_SIGNUP_04_회원정보_입력["회원정보 입력"]
  IDENTITY_SIGNUP_04_회원정보_입력 --> IDENTITY_SIGNUP_05_가입_신청["가입 신청"]
  IDENTITY_SIGNUP_05_가입_신청 --> IDENTITY_SIGNUP_06_승인_결과_통지["승인 결과 통지"]
  IDENTITY_SIGNUP_06_승인_결과_통지 --> END_IDENTITY_SIGNUP([완료])
```

## 로그인·추가인증·세션

```mermaid
flowchart LR
  START_IDENTITY_ACCESS([시작])
  START_IDENTITY_ACCESS --> IDENTITY_ACCESS_01_자격증명_입력["자격증명 입력"]
  IDENTITY_ACCESS_01_자격증명_입력 --> IDENTITY_ACCESS_02_위험기반_추가인증["위험기반 추가인증"]
  IDENTITY_ACCESS_02_위험기반_추가인증 --> IDENTITY_ACCESS_03_계정_상태_확인["계정·상태 확인"]
  IDENTITY_ACCESS_03_계정_상태_확인 --> IDENTITY_ACCESS_04_액터_데이터범위_로드["액터·데이터범위 로드"]
  IDENTITY_ACCESS_04_액터_데이터범위_로드 --> IDENTITY_ACCESS_05_세션_발급["세션 발급"]
  IDENTITY_ACCESS_05_세션_발급 --> IDENTITY_ACCESS_06_로그인_감사["로그인 감사"]
  IDENTITY_ACCESS_06_로그인_감사 --> END_IDENTITY_ACCESS([완료])
```

## 계정 찾기·비밀번호 재설정

```mermaid
flowchart LR
  START_MEMBER_RECOVERY([시작])
  START_MEMBER_RECOVERY --> MEMBER_RECOVERY_01_계정_식별["계정 식별"]
  MEMBER_RECOVERY_01_계정_식별 --> MEMBER_RECOVERY_02_추가인증["추가인증"]
  MEMBER_RECOVERY_02_추가인증 --> MEMBER_RECOVERY_03_재설정_요청["재설정 요청"]
  MEMBER_RECOVERY_03_재설정_요청 --> MEMBER_RECOVERY_04_기존_세션_폐기["기존 세션 폐기"]
  MEMBER_RECOVERY_04_기존_세션_폐기 --> MEMBER_RECOVERY_05_완료_통지["완료 통지"]
  MEMBER_RECOVERY_05_완료_통지 --> END_MEMBER_RECOVERY([완료])
```

## 회원 변경·휴면·탈퇴

```mermaid
flowchart LR
  START_MEMBER_LIFECYCLE([시작])
  START_MEMBER_LIFECYCLE --> MEMBER_LIFECYCLE_01_변경_요청["변경 요청"]
  MEMBER_LIFECYCLE_01_변경_요청 --> MEMBER_LIFECYCLE_02_영향_분석["영향 분석"]
  MEMBER_LIFECYCLE_02_영향_분석 --> MEMBER_LIFECYCLE_03_본인_승인_확인["본인·승인 확인"]
  MEMBER_LIFECYCLE_03_본인_승인_확인 --> MEMBER_LIFECYCLE_04_권한_업무_재배정["권한·업무 재배정"]
  MEMBER_LIFECYCLE_04_권한_업무_재배정 --> MEMBER_LIFECYCLE_05_정보_변경_분리보관_파기["정보 변경·분리보관·파기"]
  MEMBER_LIFECYCLE_05_정보_변경_분리보관_파기 --> MEMBER_LIFECYCLE_06_후속_시스템_통지["후속 시스템 통지"]
  MEMBER_LIFECYCLE_06_후속_시스템_통지 --> MEMBER_LIFECYCLE_07_감사["감사"]
  MEMBER_LIFECYCLE_07_감사 --> END_MEMBER_LIFECYCLE([완료])
```

## 기업·사업장 온보딩

```mermaid
flowchart LR
  START_COMPANY_ONBOARDING([시작])
  START_COMPANY_ONBOARDING --> COMPANY_ONBOARDING_01_기업_검색_중복확인["기업 검색·중복확인"]
  COMPANY_ONBOARDING_01_기업_검색_중복확인 --> COMPANY_ONBOARDING_02_법인_정보_입력["법인 정보 입력"]
  COMPANY_ONBOARDING_02_법인_정보_입력 --> COMPANY_ONBOARDING_03_증빙_제출["증빙 제출"]
  COMPANY_ONBOARDING_03_증빙_제출 --> COMPANY_ONBOARDING_04_조직_사업장_등록["조직·사업장 등록"]
  COMPANY_ONBOARDING_04_조직_사업장_등록 --> COMPANY_ONBOARDING_05_대표권_확인["대표권 확인"]
  COMPANY_ONBOARDING_05_대표권_확인 --> COMPANY_ONBOARDING_06_관리자_승인["관리자 승인"]
  COMPANY_ONBOARDING_06_관리자_승인 --> COMPANY_ONBOARDING_07_테넌트_개통["테넌트 개통"]
  COMPANY_ONBOARDING_07_테넌트_개통 --> END_COMPANY_ONBOARDING([완료])
```

## 역할·권한·위임

```mermaid
flowchart LR
  START_ROLE_ASSIGNMENT([시작])
  START_ROLE_ASSIGNMENT --> ROLE_ASSIGNMENT_01_대상_사용자_검색["대상 사용자 검색"]
  ROLE_ASSIGNMENT_01_대상_사용자_검색 --> ROLE_ASSIGNMENT_02_액터_데이터범위_선택["액터·데이터범위 선택"]
  ROLE_ASSIGNMENT_02_액터_데이터범위_선택 --> ROLE_ASSIGNMENT_03_직무분리_충돌_검사["직무분리 충돌 검사"]
  ROLE_ASSIGNMENT_03_직무분리_충돌_검사 --> ROLE_ASSIGNMENT_04_승인["승인"]
  ROLE_ASSIGNMENT_04_승인 --> ROLE_ASSIGNMENT_05_권한_적용["권한 적용"]
  ROLE_ASSIGNMENT_05_권한_적용 --> ROLE_ASSIGNMENT_06_캐시_세션_무효화["캐시·세션 무효화"]
  ROLE_ASSIGNMENT_06_캐시_세션_무효화 --> ROLE_ASSIGNMENT_07_이력_저장["이력 저장"]
  ROLE_ASSIGNMENT_07_이력_저장 --> END_ROLE_ASSIGNMENT([완료])
```

## 배출량 프로젝트 생애주기

```mermaid
flowchart LR
  START_EMISSION_PROJECT([시작])
  START_EMISSION_PROJECT --> EMISSION_PROJECT_01_프로젝트_등록["프로젝트 등록"]
  EMISSION_PROJECT_01_프로젝트_등록 --> EMISSION_PROJECT_02_조직_운영경계_설정["조직·운영경계 설정"]
  EMISSION_PROJECT_02_조직_운영경계_설정 --> EMISSION_PROJECT_03_산정기간_방법론_설정["산정기간·방법론 설정"]
  EMISSION_PROJECT_03_산정기간_방법론_설정 --> EMISSION_PROJECT_04_담당_액터_마감_배정["담당 액터·마감 배정"]
  EMISSION_PROJECT_04_담당_액터_마감_배정 --> EMISSION_PROJECT_05_자료수집_개시["자료수집 개시"]
  EMISSION_PROJECT_05_자료수집_개시 --> EMISSION_PROJECT_06_산정_검증["산정·검증"]
  EMISSION_PROJECT_06_산정_검증 --> EMISSION_PROJECT_07_승인_확정["승인·확정"]
  EMISSION_PROJECT_07_승인_확정 --> EMISSION_PROJECT_08_보고_종료["보고·종료"]
  EMISSION_PROJECT_08_보고_종료 --> END_EMISSION_PROJECT([완료])
```

## 활동자료 제출 요청

```mermaid
flowchart LR
  START_ACTIVITY_REQUEST([시작])
  START_ACTIVITY_REQUEST --> ACTIVITY_REQUEST_01_요청범위_설정["요청범위 설정"]
  ACTIVITY_REQUEST_01_요청범위_설정 --> ACTIVITY_REQUEST_02_대상_사업장_담당자_검색["대상 사업장·담당자 검색"]
  ACTIVITY_REQUEST_02_대상_사업장_담당자_검색 --> ACTIVITY_REQUEST_03_입력양식_마감_선택["입력양식·마감 선택"]
  ACTIVITY_REQUEST_03_입력양식_마감_선택 --> ACTIVITY_REQUEST_04_요청_발송["요청 발송"]
  ACTIVITY_REQUEST_04_요청_발송 --> ACTIVITY_REQUEST_05_수신_열람_추적["수신·열람 추적"]
  ACTIVITY_REQUEST_05_수신_열람_추적 --> ACTIVITY_REQUEST_06_미제출_알림_에스컬레이션["미제출 알림·에스컬레이션"]
  ACTIVITY_REQUEST_06_미제출_알림_에스컬레이션 --> END_ACTIVITY_REQUEST([완료])
```

## 활동자료 입력·보완

```mermaid
flowchart LR
  START_ACTIVITY_DATA([시작])
  START_ACTIVITY_DATA --> ACTIVITY_DATA_01_업무_수신["업무 수신"]
  ACTIVITY_DATA_01_업무_수신 --> ACTIVITY_DATA_02_자료_입력_엑셀_업로드["자료 입력·엑셀 업로드"]
  ACTIVITY_DATA_02_자료_입력_엑셀_업로드 --> ACTIVITY_DATA_03_단위_기간_출처_검증["단위·기간·출처 검증"]
  ACTIVITY_DATA_03_단위_기간_출처_검증 --> ACTIVITY_DATA_04_증빙_연결["증빙 연결"]
  ACTIVITY_DATA_04_증빙_연결 --> ACTIVITY_DATA_05_임시저장["임시저장"]
  ACTIVITY_DATA_05_임시저장 --> ACTIVITY_DATA_06_제출["제출"]
  ACTIVITY_DATA_06_제출 --> ACTIVITY_DATA_07_반려_보완["반려 보완"]
  ACTIVITY_DATA_07_반려_보완 --> ACTIVITY_DATA_08_재제출["재제출"]
  ACTIVITY_DATA_08_재제출 --> END_ACTIVITY_DATA([완료])
```

## 증빙자료 생애주기

```mermaid
flowchart LR
  START_EVIDENCE_MANAGEMENT([시작])
  START_EVIDENCE_MANAGEMENT --> EVIDENCE_MANAGEMENT_01_파일_검사["파일 검사"]
  EVIDENCE_MANAGEMENT_01_파일_검사 --> EVIDENCE_MANAGEMENT_02_업로드["업로드"]
  EVIDENCE_MANAGEMENT_02_업로드 --> EVIDENCE_MANAGEMENT_03_자료행_연결["자료행 연결"]
  EVIDENCE_MANAGEMENT_03_자료행_연결 --> EVIDENCE_MANAGEMENT_04_해시_메타데이터_저장["해시·메타데이터 저장"]
  EVIDENCE_MANAGEMENT_04_해시_메타데이터_저장 --> EVIDENCE_MANAGEMENT_05_열람권한_적용["열람권한 적용"]
  EVIDENCE_MANAGEMENT_05_열람권한_적용 --> EVIDENCE_MANAGEMENT_06_버전_변경["버전 변경"]
  EVIDENCE_MANAGEMENT_06_버전_변경 --> EVIDENCE_MANAGEMENT_07_보존_파기["보존·파기"]
  EVIDENCE_MANAGEMENT_07_보존_파기 --> END_EVIDENCE_MANAGEMENT([완료])
```

## 배출계수·단위 매핑

```mermaid
flowchart LR
  START_FACTOR_MAPPING([시작])
  START_FACTOR_MAPPING --> FACTOR_MAPPING_01_미매핑_자료_조회["미매핑 자료 조회"]
  FACTOR_MAPPING_01_미매핑_자료_조회 --> FACTOR_MAPPING_02_물질_연료_검색["물질·연료 검색"]
  FACTOR_MAPPING_02_물질_연료_검색 --> FACTOR_MAPPING_03_후보_순위_근거_확인["후보 순위·근거 확인"]
  FACTOR_MAPPING_03_후보_순위_근거_확인 --> FACTOR_MAPPING_04_단위_환산_선택["단위 환산 선택"]
  FACTOR_MAPPING_04_단위_환산_선택 --> FACTOR_MAPPING_05_개별_일괄_매핑["개별·일괄 매핑"]
  FACTOR_MAPPING_05_개별_일괄_매핑 --> FACTOR_MAPPING_06_충돌_검증["충돌 검증"]
  FACTOR_MAPPING_06_충돌_검증 --> FACTOR_MAPPING_07_매핑_확정_버전_저장["매핑 확정·버전 저장"]
  FACTOR_MAPPING_07_매핑_확정_버전_저장 --> END_FACTOR_MAPPING([완료])
```

## Scope 1·2·3 배출량 산정

```mermaid
flowchart LR
  START_EMISSION_CALCULATION([시작])
  START_EMISSION_CALCULATION --> EMISSION_CALCULATION_01_산정대상_잠금["산정대상 잠금"]
  EMISSION_CALCULATION_01_산정대상_잠금 --> EMISSION_CALCULATION_02_방법론_계수_버전_확인["방법론·계수 버전 확인"]
  EMISSION_CALCULATION_02_방법론_계수_버전_확인 --> EMISSION_CALCULATION_03_단위_환산["단위 환산"]
  EMISSION_CALCULATION_03_단위_환산 --> EMISSION_CALCULATION_04_행별_산정["행별 산정"]
  EMISSION_CALCULATION_04_행별_산정 --> EMISSION_CALCULATION_05_시설_사업장_SCOPE_집계["시설·사업장·Scope 집계"]
  EMISSION_CALCULATION_05_시설_사업장_SCOPE_집계 --> EMISSION_CALCULATION_06_불확도_품질_평가["불확도·품질 평가"]
  EMISSION_CALCULATION_06_불확도_품질_평가 --> EMISSION_CALCULATION_07_계산근거_저장["계산근거 저장"]
  EMISSION_CALCULATION_07_계산근거_저장 --> EMISSION_CALCULATION_08_결과_제출["결과 제출"]
  EMISSION_CALCULATION_08_결과_제출 --> END_EMISSION_CALCULATION([완료])
```

## 배출량 데이터 검증

```mermaid
flowchart LR
  START_EMISSION_VALIDATION([시작])
  START_EMISSION_VALIDATION --> EMISSION_VALIDATION_01_검증계획_수립["검증계획 수립"]
  EMISSION_VALIDATION_01_검증계획_수립 --> EMISSION_VALIDATION_02_완전성_일관성_검사["완전성·일관성 검사"]
  EMISSION_VALIDATION_02_완전성_일관성_검사 --> EMISSION_VALIDATION_03_이상치_중복_검사["이상치·중복 검사"]
  EMISSION_VALIDATION_03_이상치_중복_검사 --> EMISSION_VALIDATION_04_증빙_표본검사["증빙 표본검사"]
  EMISSION_VALIDATION_04_증빙_표본검사 --> EMISSION_VALIDATION_05_계산_재현["계산 재현"]
  EMISSION_VALIDATION_05_계산_재현 --> EMISSION_VALIDATION_06_발견사항_등록["발견사항 등록"]
  EMISSION_VALIDATION_06_발견사항_등록 --> EMISSION_VALIDATION_07_보완_확인["보완 확인"]
  EMISSION_VALIDATION_07_보완_확인 --> EMISSION_VALIDATION_08_검증_결론["검증 결론"]
  EMISSION_VALIDATION_08_검증_결론 --> END_EMISSION_VALIDATION([완료])
```

## 배출량 검토·승인·확정

```mermaid
flowchart LR
  START_EMISSION_APPROVAL([시작])
  START_EMISSION_APPROVAL --> EMISSION_APPROVAL_01_승인대상_조회["승인대상 조회"]
  EMISSION_APPROVAL_01_승인대상_조회 --> EMISSION_APPROVAL_02_변경_위험_요약_확인["변경·위험 요약 확인"]
  EMISSION_APPROVAL_02_변경_위험_요약_확인 --> EMISSION_APPROVAL_03_검증의견_확인["검증의견 확인"]
  EMISSION_APPROVAL_03_검증의견_확인 --> EMISSION_APPROVAL_04_승인_반려["승인·반려"]
  EMISSION_APPROVAL_04_승인_반려 --> EMISSION_APPROVAL_05_전자서명["전자서명"]
  EMISSION_APPROVAL_05_전자서명 --> EMISSION_APPROVAL_06_결과_잠금["결과 잠금"]
  EMISSION_APPROVAL_06_결과_잠금 --> EMISSION_APPROVAL_07_재개_통제["재개 통제"]
  EMISSION_APPROVAL_07_재개_통제 --> END_EMISSION_APPROVAL([완료])
```

## 온실가스 명세서 작성·제출

```mermaid
flowchart LR
  START_STATEMENT_REPORT([시작])
  START_STATEMENT_REPORT --> STATEMENT_REPORT_01_확정_데이터_선택["확정 데이터 선택"]
  STATEMENT_REPORT_01_확정_데이터_선택 --> STATEMENT_REPORT_02_법정_서식_생성["법정 서식 생성"]
  STATEMENT_REPORT_02_법정_서식_생성 --> STATEMENT_REPORT_03_총괄_사업장_시설_대조["총괄·사업장·시설 대조"]
  STATEMENT_REPORT_03_총괄_사업장_시설_대조 --> STATEMENT_REPORT_04_검증보고서_첨부["검증보고서 첨부"]
  STATEMENT_REPORT_04_검증보고서_첨부 --> STATEMENT_REPORT_05_전자서명["전자서명"]
  STATEMENT_REPORT_05_전자서명 --> STATEMENT_REPORT_06_전자_제출["전자 제출"]
  STATEMENT_REPORT_06_전자_제출 --> STATEMENT_REPORT_07_접수_보완["접수·보완"]
  STATEMENT_REPORT_07_접수_보완 --> STATEMENT_REPORT_08_최종_보존["최종 보존"]
  STATEMENT_REPORT_08_최종_보존 --> END_STATEMENT_REPORT([완료])
```

## 제품 LCA 프로젝트

```mermaid
flowchart LR
  START_LCA_PROJECT([시작])
  START_LCA_PROJECT --> LCA_PROJECT_01_목표_범위_설정["목표·범위 설정"]
  LCA_PROJECT_01_목표_범위_설정 --> LCA_PROJECT_02_제품_공정_선택["제품·공정 선택"]
  LCA_PROJECT_02_제품_공정_선택 --> LCA_PROJECT_03_기능단위_설정["기능단위 설정"]
  LCA_PROJECT_03_기능단위_설정 --> LCA_PROJECT_04_시스템경계_설정["시스템경계 설정"]
  LCA_PROJECT_04_시스템경계_설정 --> LCA_PROJECT_05_데이터수집_계획["데이터수집 계획"]
  LCA_PROJECT_05_데이터수집_계획 --> LCA_PROJECT_06_인벤토리_영향평가["인벤토리·영향평가"]
  LCA_PROJECT_06_인벤토리_영향평가 --> LCA_PROJECT_07_검토_확정["검토·확정"]
  LCA_PROJECT_07_검토_확정 --> LCA_PROJECT_08_보고["보고"]
  LCA_PROJECT_08_보고 --> END_LCA_PROJECT([완료])
```

## LCI 인벤토리 수집·매핑

```mermaid
flowchart LR
  START_LCA_INVENTORY([시작])
  START_LCA_INVENTORY --> LCA_INVENTORY_01_공정_흐름_구성["공정 흐름 구성"]
  LCA_INVENTORY_01_공정_흐름_구성 --> LCA_INVENTORY_02_원료_보조재_입력["원료·보조재 입력"]
  LCA_INVENTORY_02_원료_보조재_입력 --> LCA_INVENTORY_03_에너지_스팀_입력["에너지·스팀 입력"]
  LCA_INVENTORY_03_에너지_스팀_입력 --> LCA_INVENTORY_04_운송_입력["운송 입력"]
  LCA_INVENTORY_04_운송_입력 --> LCA_INVENTORY_05_제품_부산물_입력["제품·부산물 입력"]
  LCA_INVENTORY_05_제품_부산물_입력 --> LCA_INVENTORY_06_폐기물_배출물_입력["폐기물·배출물 입력"]
  LCA_INVENTORY_06_폐기물_배출물_입력 --> LCA_INVENTORY_07_LCI_검색_매핑["LCI 검색·매핑"]
  LCA_INVENTORY_07_LCI_검색_매핑 --> LCA_INVENTORY_08_질량_에너지_수지_검증["질량·에너지 수지 검증"]
  LCA_INVENTORY_08_질량_에너지_수지_검증 --> END_LCA_INVENTORY([완료])
```

## 제품·부산물 할당

```mermaid
flowchart LR
  START_LCA_ALLOCATION([시작])
  START_LCA_ALLOCATION --> LCA_ALLOCATION_01_산출물_분류["산출물 분류"]
  LCA_ALLOCATION_01_산출물_분류 --> LCA_ALLOCATION_02_질량_경제_물리_기준_선택["질량·경제·물리 기준 선택"]
  LCA_ALLOCATION_02_질량_경제_물리_기준_선택 --> LCA_ALLOCATION_03_기준자료_입력["기준자료 입력"]
  LCA_ALLOCATION_03_기준자료_입력 --> LCA_ALLOCATION_04_할당비율_계산["할당비율 계산"]
  LCA_ALLOCATION_04_할당비율_계산 --> LCA_ALLOCATION_05_100__정합성_검사["100% 정합성 검사"]
  LCA_ALLOCATION_05_100__정합성_검사 --> LCA_ALLOCATION_06_민감도_비교["민감도 비교"]
  LCA_ALLOCATION_06_민감도_비교 --> LCA_ALLOCATION_07_기준_확정["기준 확정"]
  LCA_ALLOCATION_07_기준_확정 --> END_LCA_ALLOCATION([완료])
```

## LCIA 영향평가·기여도 분석

```mermaid
flowchart LR
  START_LCA_IMPACT([시작])
  START_LCA_IMPACT --> LCA_IMPACT_01_영향범주_방법_선택["영향범주·방법 선택"]
  LCA_IMPACT_01_영향범주_방법_선택 --> LCA_IMPACT_02_특성화_계수_버전_선택["특성화 계수 버전 선택"]
  LCA_IMPACT_02_특성화_계수_버전_선택 --> LCA_IMPACT_03_영향평가_계산["영향평가 계산"]
  LCA_IMPACT_03_영향평가_계산 --> LCA_IMPACT_04_공정별_기여도["공정별 기여도"]
  LCA_IMPACT_04_공정별_기여도 --> LCA_IMPACT_05_원료별_기여도["원료별 기여도"]
  LCA_IMPACT_05_원료별_기여도 --> LCA_IMPACT_06_민감도_시나리오["민감도·시나리오"]
  LCA_IMPACT_06_민감도_시나리오 --> LCA_IMPACT_07_결과_검토["결과 검토"]
  LCA_IMPACT_07_결과_검토 --> END_LCA_IMPACT([완료])
```

## LCA·제품탄소발자국 보고

```mermaid
flowchart LR
  START_LCA_REPORT([시작])
  START_LCA_REPORT --> LCA_REPORT_01_확정_결과_선택["확정 결과 선택"]
  LCA_REPORT_01_확정_결과_선택 --> LCA_REPORT_02_요약_상세_보고서_생성["요약·상세 보고서 생성"]
  LCA_REPORT_02_요약_상세_보고서_생성 --> LCA_REPORT_03_가정_제외_품질_표시["가정·제외·품질 표시"]
  LCA_REPORT_03_가정_제외_품질_표시 --> LCA_REPORT_04_독립_검토["독립 검토"]
  LCA_REPORT_04_독립_검토 --> LCA_REPORT_05_보고서_확정["보고서 확정"]
  LCA_REPORT_05_보고서_확정 --> LCA_REPORT_06_발급_공개_범위_설정["발급·공개 범위 설정"]
  LCA_REPORT_06_발급_공개_범위_설정 --> END_LCA_REPORT([완료])
```

## 감축 목표·로드맵

```mermaid
flowchart LR
  START_REDUCTION_TARGET([시작])
  START_REDUCTION_TARGET --> REDUCTION_TARGET_01_기준연도_설정["기준연도 설정"]
  REDUCTION_TARGET_01_기준연도_설정 --> REDUCTION_TARGET_02_기준배출량_확정["기준배출량 확정"]
  REDUCTION_TARGET_02_기준배출량_확정 --> REDUCTION_TARGET_03_조직_사업장_목표_배분["조직·사업장 목표 배분"]
  REDUCTION_TARGET_03_조직_사업장_목표_배분 --> REDUCTION_TARGET_04_목표_시나리오["목표 시나리오"]
  REDUCTION_TARGET_04_목표_시나리오 --> REDUCTION_TARGET_05_로드맵_작성["로드맵 작성"]
  REDUCTION_TARGET_05_로드맵_작성 --> REDUCTION_TARGET_06_승인["승인"]
  REDUCTION_TARGET_06_승인 --> REDUCTION_TARGET_07_변경관리["변경관리"]
  REDUCTION_TARGET_07_변경관리 --> END_REDUCTION_TARGET([완료])
```

## 감축 과제 생애주기

```mermaid
flowchart LR
  START_REDUCTION_INITIATIVE([시작])
  START_REDUCTION_INITIATIVE --> REDUCTION_INITIATIVE_01_과제_등록["과제 등록"]
  REDUCTION_INITIATIVE_01_과제_등록 --> REDUCTION_INITIATIVE_02_감축수단_경계_설정["감축수단·경계 설정"]
  REDUCTION_INITIATIVE_02_감축수단_경계_설정 --> REDUCTION_INITIATIVE_03_예상_감축량_산정["예상 감축량 산정"]
  REDUCTION_INITIATIVE_03_예상_감축량_산정 --> REDUCTION_INITIATIVE_04_예산_일정_담당자["예산·일정·담당자"]
  REDUCTION_INITIATIVE_04_예산_일정_담당자 --> REDUCTION_INITIATIVE_05_타당성_검토["타당성 검토"]
  REDUCTION_INITIATIVE_05_타당성_검토 --> REDUCTION_INITIATIVE_06_승인["승인"]
  REDUCTION_INITIATIVE_06_승인 --> REDUCTION_INITIATIVE_07_실행["실행"]
  REDUCTION_INITIATIVE_07_실행 --> REDUCTION_INITIATIVE_08_종료["종료"]
  REDUCTION_INITIATIVE_08_종료 --> END_REDUCTION_INITIATIVE([완료])
```

## 감축 실적·성과 검증

```mermaid
flowchart LR
  START_REDUCTION_PERFORMANCE([시작])
  START_REDUCTION_PERFORMANCE --> REDUCTION_PERFORMANCE_01_모니터링_자료_수집["모니터링 자료 수집"]
  REDUCTION_PERFORMANCE_01_모니터링_자료_수집 --> REDUCTION_PERFORMANCE_02_기준선_조정["기준선 조정"]
  REDUCTION_PERFORMANCE_02_기준선_조정 --> REDUCTION_PERFORMANCE_03_실제_감축량_산정["실제 감축량 산정"]
  REDUCTION_PERFORMANCE_03_실제_감축량_산정 --> REDUCTION_PERFORMANCE_04_비용_효과_분석["비용·효과 분석"]
  REDUCTION_PERFORMANCE_04_비용_효과_분석 --> REDUCTION_PERFORMANCE_05_검증["검증"]
  REDUCTION_PERFORMANCE_05_검증 --> REDUCTION_PERFORMANCE_06_승인["승인"]
  REDUCTION_PERFORMANCE_06_승인 --> REDUCTION_PERFORMANCE_07_성과_보고["성과 보고"]
  REDUCTION_PERFORMANCE_07_성과_보고 --> END_REDUCTION_PERFORMANCE([완료])
```

## 통합 모니터링·이상치 대응

```mermaid
flowchart LR
  START_MONITORING_ANALYSIS([시작])
  START_MONITORING_ANALYSIS --> MONITORING_ANALYSIS_01_분석범위_선택["분석범위 선택"]
  MONITORING_ANALYSIS_01_분석범위_선택 --> MONITORING_ANALYSIS_02_지표_집계["지표 집계"]
  MONITORING_ANALYSIS_02_지표_집계 --> MONITORING_ANALYSIS_03_목표_대비_분석["목표 대비 분석"]
  MONITORING_ANALYSIS_03_목표_대비_분석 --> MONITORING_ANALYSIS_04_품질_점수["품질 점수"]
  MONITORING_ANALYSIS_04_품질_점수 --> MONITORING_ANALYSIS_05_이상치_경보["이상치·경보"]
  MONITORING_ANALYSIS_05_이상치_경보 --> MONITORING_ANALYSIS_06_원인_조사["원인 조사"]
  MONITORING_ANALYSIS_06_원인_조사 --> MONITORING_ANALYSIS_07_조치_종결["조치·종결"]
  MONITORING_ANALYSIS_07_조치_종결 --> MONITORING_ANALYSIS_08_공유_내보내기["공유·내보내기"]
  MONITORING_ANALYSIS_08_공유_내보내기 --> END_MONITORING_ANALYSIS([완료])
```

## CO2 포집 운영

```mermaid
flowchart LR
  START_CCUS_CAPTURE([시작])
  START_CCUS_CAPTURE --> CCUS_CAPTURE_01_배출원_설비_등록["배출원·설비 등록"]
  CCUS_CAPTURE_01_배출원_설비_등록 --> CCUS_CAPTURE_02_포집계획["포집계획"]
  CCUS_CAPTURE_02_포집계획 --> CCUS_CAPTURE_03_포집량_운전자료_수집["포집량·운전자료 수집"]
  CCUS_CAPTURE_03_포집량_운전자료_수집 --> CCUS_CAPTURE_04_CO2_품질_검사["CO2 품질 검사"]
  CCUS_CAPTURE_04_CO2_품질_검사 --> CCUS_CAPTURE_05_손실_누출_산정["손실·누출 산정"]
  CCUS_CAPTURE_05_손실_누출_산정 --> CCUS_CAPTURE_06_인계_계량["인계 계량"]
  CCUS_CAPTURE_06_인계_계량 --> CCUS_CAPTURE_07_운영기록_보존["운영기록 보존"]
  CCUS_CAPTURE_07_운영기록_보존 --> END_CCUS_CAPTURE([완료])
```

## CO2 수송·인수인계

```mermaid
flowchart LR
  START_CCUS_TRANSPORT([시작])
  START_CCUS_TRANSPORT --> CCUS_TRANSPORT_01_수송계약_경로["수송계약·경로"]
  CCUS_TRANSPORT_01_수송계약_경로 --> CCUS_TRANSPORT_02_인수_계량_품질_확인["인수 계량·품질 확인"]
  CCUS_TRANSPORT_02_인수_계량_품질_확인 --> CCUS_TRANSPORT_03_운송수단_안전_확인["운송수단·안전 확인"]
  CCUS_TRANSPORT_03_운송수단_안전_확인 --> CCUS_TRANSPORT_04_수송_추적["수송 추적"]
  CCUS_TRANSPORT_04_수송_추적 --> CCUS_TRANSPORT_05_사고_누출_대응["사고·누출 대응"]
  CCUS_TRANSPORT_05_사고_누출_대응 --> CCUS_TRANSPORT_06_인계_계량["인계 계량"]
  CCUS_TRANSPORT_06_인계_계량 --> CCUS_TRANSPORT_07_차이_조정_기록["차이 조정·기록"]
  CCUS_TRANSPORT_07_차이_조정_기록 --> END_CCUS_TRANSPORT([완료])
```

## CO2 저장·모니터링

```mermaid
flowchart LR
  START_CCUS_STORAGE([시작])
  START_CCUS_STORAGE --> CCUS_STORAGE_01_저장소_허가_확인["저장소·허가 확인"]
  CCUS_STORAGE_01_저장소_허가_확인 --> CCUS_STORAGE_02_주입계획["주입계획"]
  CCUS_STORAGE_02_주입계획 --> CCUS_STORAGE_03_인수_주입_계량["인수·주입 계량"]
  CCUS_STORAGE_03_인수_주입_계량 --> CCUS_STORAGE_04_압력_거동_모니터링["압력·거동 모니터링"]
  CCUS_STORAGE_04_압력_거동_모니터링 --> CCUS_STORAGE_05_누출_이상_대응["누출·이상 대응"]
  CCUS_STORAGE_05_누출_이상_대응 --> CCUS_STORAGE_06_저장량_검증["저장량 검증"]
  CCUS_STORAGE_06_저장량_검증 --> CCUS_STORAGE_07_폐쇄_사후관리["폐쇄·사후관리"]
  CCUS_STORAGE_07_폐쇄_사후관리 --> CCUS_STORAGE_08_운영기록_보존["운영기록 보존"]
  CCUS_STORAGE_08_운영기록_보존 --> END_CCUS_STORAGE([완료])
```

## CO2 활용·제품 추적

```mermaid
flowchart LR
  START_CCUS_UTILIZATION([시작])
  START_CCUS_UTILIZATION --> CCUS_UTILIZATION_01_활용공정_제품_등록["활용공정·제품 등록"]
  CCUS_UTILIZATION_01_활용공정_제품_등록 --> CCUS_UTILIZATION_02_CO2_인수_품질_확인["CO2 인수·품질 확인"]
  CCUS_UTILIZATION_02_CO2_인수_품질_확인 --> CCUS_UTILIZATION_03_투입_산출_수지["투입·산출 수지"]
  CCUS_UTILIZATION_03_투입_산출_수지 --> CCUS_UTILIZATION_04_고정_재방출량_산정["고정·재방출량 산정"]
  CCUS_UTILIZATION_04_고정_재방출량_산정 --> CCUS_UTILIZATION_05_제품_부산물_추적["제품·부산물 추적"]
  CCUS_UTILIZATION_05_제품_부산물_추적 --> CCUS_UTILIZATION_06_감축량_산정["감축량 산정"]
  CCUS_UTILIZATION_06_감축량_산정 --> CCUS_UTILIZATION_07_인증_신청["인증 신청"]
  CCUS_UTILIZATION_07_인증_신청 --> END_CCUS_UTILIZATION([완료])
```

## CCUS 전 과정 질량수지·감축량

```mermaid
flowchart LR
  START_CO2_MASS_BALANCE([시작])
  START_CO2_MASS_BALANCE --> CO2_MASS_BALANCE_01_포집_수송_저장_활용_데이터_잠금["포집·수송·저장·활용 데이터 잠금"]
  CO2_MASS_BALANCE_01_포집_수송_저장_활용_데이터_잠금 --> CO2_MASS_BALANCE_02_계량기_단위_정규화["계량기·단위 정규화"]
  CO2_MASS_BALANCE_02_계량기_단위_정규화 --> CO2_MASS_BALANCE_03_인수인계_차이_조정["인수인계 차이 조정"]
  CO2_MASS_BALANCE_03_인수인계_차이_조정 --> CO2_MASS_BALANCE_04_누출_에너지_배출_반영["누출·에너지 배출 반영"]
  CO2_MASS_BALANCE_04_누출_에너지_배출_반영 --> CO2_MASS_BALANCE_05_중복계상_검사["중복계상 검사"]
  CO2_MASS_BALANCE_05_중복계상_검사 --> CO2_MASS_BALANCE_06_순감축량_산정["순감축량 산정"]
  CO2_MASS_BALANCE_06_순감축량_산정 --> CO2_MASS_BALANCE_07_검증_확정["검증·확정"]
  CO2_MASS_BALANCE_07_검증_확정 --> END_CO2_MASS_BALANCE([완료])
```

## CO2 공급·수요 등록·매칭

```mermaid
flowchart LR
  START_SUPPLY_DEMAND([시작])
  START_SUPPLY_DEMAND --> SUPPLY_DEMAND_01_공급_수요_등록["공급·수요 등록"]
  SUPPLY_DEMAND_01_공급_수요_등록 --> SUPPLY_DEMAND_02_품질_물량_기간_위치_검증["품질·물량·기간·위치 검증"]
  SUPPLY_DEMAND_02_품질_물량_기간_위치_검증 --> SUPPLY_DEMAND_03_상대방_검색["상대방 검색"]
  SUPPLY_DEMAND_03_상대방_검색 --> SUPPLY_DEMAND_04_매칭_후보_산출["매칭 후보 산출"]
  SUPPLY_DEMAND_04_매칭_후보_산출 --> SUPPLY_DEMAND_05_후보_비교["후보 비교"]
  SUPPLY_DEMAND_05_후보_비교 --> SUPPLY_DEMAND_06_협의_요청["협의 요청"]
  SUPPLY_DEMAND_06_협의_요청 --> SUPPLY_DEMAND_07_매칭_확정["매칭 확정"]
  SUPPLY_DEMAND_07_매칭_확정 --> END_SUPPLY_DEMAND([완료])
```

## 거래 제안·계약·이행

```mermaid
flowchart LR
  START_TRADE_EXECUTION([시작])
  START_TRADE_EXECUTION --> TRADE_EXECUTION_01_거래_제안["거래 제안"]
  TRADE_EXECUTION_01_거래_제안 --> TRADE_EXECUTION_02_협상_변경_이력["협상·변경 이력"]
  TRADE_EXECUTION_02_협상_변경_이력 --> TRADE_EXECUTION_03_상대방_적격성["상대방 적격성"]
  TRADE_EXECUTION_03_상대방_적격성 --> TRADE_EXECUTION_04_전자계약["전자계약"]
  TRADE_EXECUTION_04_전자계약 --> TRADE_EXECUTION_05_인도_계획["인도 계획"]
  TRADE_EXECUTION_05_인도_계획 --> TRADE_EXECUTION_06_인수인계_증적["인수인계 증적"]
  TRADE_EXECUTION_06_인수인계_증적 --> TRADE_EXECUTION_07_이행_완료["이행 완료"]
  TRADE_EXECUTION_07_이행_완료 --> TRADE_EXECUTION_08_분쟁_취소["분쟁·취소"]
  TRADE_EXECUTION_08_분쟁_취소 --> END_TRADE_EXECUTION([완료])
```

## 거래 정산·결제·환불

```mermaid
flowchart LR
  START_SETTLEMENT([시작])
  START_SETTLEMENT --> SETTLEMENT_01_정산대상_확정["정산대상 확정"]
  SETTLEMENT_01_정산대상_확정 --> SETTLEMENT_02_금액_세금_계산["금액·세금 계산"]
  SETTLEMENT_02_금액_세금_계산 --> SETTLEMENT_03_청구_결제["청구·결제"]
  SETTLEMENT_03_청구_결제 --> SETTLEMENT_04_입금_대사["입금 대사"]
  SETTLEMENT_04_입금_대사 --> SETTLEMENT_05_세금계산서["세금계산서"]
  SETTLEMENT_05_세금계산서 --> SETTLEMENT_06_정산_지급["정산 지급"]
  SETTLEMENT_06_정산_지급 --> SETTLEMENT_07_환불_취소["환불·취소"]
  SETTLEMENT_07_환불_취소 --> SETTLEMENT_08_회계_증적["회계 증적"]
  SETTLEMENT_08_회계_증적 --> END_SETTLEMENT([완료])
```

## 인증서 신청·검토·발급

```mermaid
flowchart LR
  START_CERTIFICATE_ISSUANCE([시작])
  START_CERTIFICATE_ISSUANCE --> CERTIFICATE_ISSUANCE_01_발급_신청["발급 신청"]
  CERTIFICATE_ISSUANCE_01_발급_신청 --> CERTIFICATE_ISSUANCE_02_대상_결과_증적_잠금["대상 결과·증적 잠금"]
  CERTIFICATE_ISSUANCE_02_대상_결과_증적_잠금 --> CERTIFICATE_ISSUANCE_03_중복_발급_검사["중복 발급 검사"]
  CERTIFICATE_ISSUANCE_03_중복_발급_검사 --> CERTIFICATE_ISSUANCE_04_적격성_검토["적격성 검토"]
  CERTIFICATE_ISSUANCE_04_적격성_검토 --> CERTIFICATE_ISSUANCE_05_수수료_확인["수수료 확인"]
  CERTIFICATE_ISSUANCE_05_수수료_확인 --> CERTIFICATE_ISSUANCE_06_전자서명_발급["전자서명·발급"]
  CERTIFICATE_ISSUANCE_06_전자서명_발급 --> CERTIFICATE_ISSUANCE_07_공개키_진위_데이터_등록["공개키·진위 데이터 등록"]
  CERTIFICATE_ISSUANCE_07_공개키_진위_데이터_등록 --> CERTIFICATE_ISSUANCE_08_재발급_취소["재발급·취소"]
  CERTIFICATE_ISSUANCE_08_재발급_취소 --> END_CERTIFICATE_ISSUANCE([완료])
```

## 보고서·인증서 진위 확인

```mermaid
flowchart LR
  START_CERTIFICATE_VERIFY([시작])
  START_CERTIFICATE_VERIFY --> CERTIFICATE_VERIFY_01_파일_번호_QR_입력["파일·번호·QR 입력"]
  CERTIFICATE_VERIFY_01_파일_번호_QR_입력 --> CERTIFICATE_VERIFY_02_원본_레지스트리_검색["원본 레지스트리 검색"]
  CERTIFICATE_VERIFY_02_원본_레지스트리_검색 --> CERTIFICATE_VERIFY_03_전자서명_해시_검증["전자서명·해시 검증"]
  CERTIFICATE_VERIFY_03_전자서명_해시_검증 --> CERTIFICATE_VERIFY_04_시각지문_OCR_보조검사["시각지문·OCR 보조검사"]
  CERTIFICATE_VERIFY_04_시각지문_OCR_보조검사 --> CERTIFICATE_VERIFY_05_핵심_수치_물질_대조["핵심 수치·물질 대조"]
  CERTIFICATE_VERIFY_05_핵심_수치_물질_대조 --> CERTIFICATE_VERIFY_06_판정_불일치_상세["판정·불일치 상세"]
  CERTIFICATE_VERIFY_06_판정_불일치_상세 --> CERTIFICATE_VERIFY_07_조회_감사["조회 감사"]
  CERTIFICATE_VERIFY_07_조회_감사 --> END_CERTIFICATE_VERIFY([완료])
```

## 기준정보·방법론 버전 관리

```mermaid
flowchart LR
  START_REFERENCE_DATA([시작])
  START_REFERENCE_DATA --> REFERENCE_DATA_01_변경_요청["변경 요청"]
  REFERENCE_DATA_01_변경_요청 --> REFERENCE_DATA_02_법령_출처_등록["법령·출처 등록"]
  REFERENCE_DATA_02_법령_출처_등록 --> REFERENCE_DATA_03_물질_단위_계수_검색["물질·단위·계수 검색"]
  REFERENCE_DATA_03_물질_단위_계수_검색 --> REFERENCE_DATA_04_신규_개정_값_입력["신규·개정 값 입력"]
  REFERENCE_DATA_04_신규_개정_값_입력 --> REFERENCE_DATA_05_영향_분석["영향 분석"]
  REFERENCE_DATA_05_영향_분석 --> REFERENCE_DATA_06_검토_승인["검토·승인"]
  REFERENCE_DATA_06_검토_승인 --> REFERENCE_DATA_07_유효기간_배포["유효기간 배포"]
  REFERENCE_DATA_07_유효기간_배포 --> REFERENCE_DATA_08_재산정_대상_통지["재산정 대상 통지"]
  REFERENCE_DATA_08_재산정_대상_통지 --> END_REFERENCE_DATA([완료])
```

## 외부 API·동기화·재처리

```mermaid
flowchart LR
  START_EXTERNAL_INTEGRATION([시작])
  START_EXTERNAL_INTEGRATION --> EXTERNAL_INTEGRATION_01_연계시스템_등록["연계시스템 등록"]
  EXTERNAL_INTEGRATION_01_연계시스템_등록 --> EXTERNAL_INTEGRATION_02_인증_스키마_설정["인증·스키마 설정"]
  EXTERNAL_INTEGRATION_02_인증_스키마_설정 --> EXTERNAL_INTEGRATION_03_필드_매핑["필드 매핑"]
  EXTERNAL_INTEGRATION_03_필드_매핑 --> EXTERNAL_INTEGRATION_04_연결_테스트["연결 테스트"]
  EXTERNAL_INTEGRATION_04_연결_테스트 --> EXTERNAL_INTEGRATION_05_동기화_실행["동기화 실행"]
  EXTERNAL_INTEGRATION_05_동기화_실행 --> EXTERNAL_INTEGRATION_06_검증_대사["검증·대사"]
  EXTERNAL_INTEGRATION_06_검증_대사 --> EXTERNAL_INTEGRATION_07_실패_재시도_격리["실패 재시도·격리"]
  EXTERNAL_INTEGRATION_07_실패_재시도_격리 --> EXTERNAL_INTEGRATION_08_모니터링_감사["모니터링·감사"]
  EXTERNAL_INTEGRATION_08_모니터링_감사 --> END_EXTERNAL_INTEGRATION([완료])
```

## 콘텐츠·교육 운영

```mermaid
flowchart LR
  START_CONTENT_EDUCATION([시작])
  START_CONTENT_EDUCATION --> CONTENT_EDUCATION_01_콘텐츠_과정_작성["콘텐츠·과정 작성"]
  CONTENT_EDUCATION_01_콘텐츠_과정_작성 --> CONTENT_EDUCATION_02_검토_승인["검토·승인"]
  CONTENT_EDUCATION_02_검토_승인 --> CONTENT_EDUCATION_03_공개범위_예약["공개범위·예약"]
  CONTENT_EDUCATION_03_공개범위_예약 --> CONTENT_EDUCATION_04_게시_신청["게시·신청"]
  CONTENT_EDUCATION_04_게시_신청 --> CONTENT_EDUCATION_05_출석_진도_평가["출석·진도·평가"]
  CONTENT_EDUCATION_05_출석_진도_평가 --> CONTENT_EDUCATION_06_수료증["수료증"]
  CONTENT_EDUCATION_06_수료증 --> CONTENT_EDUCATION_07_보존_폐기["보존·폐기"]
  CONTENT_EDUCATION_07_보존_폐기 --> END_CONTENT_EDUCATION([완료])
```

## 문의·장애·개선 요청

```mermaid
flowchart LR
  START_CUSTOMER_SUPPORT([시작])
  START_CUSTOMER_SUPPORT --> CUSTOMER_SUPPORT_01_요청_접수["요청 접수"]
  CUSTOMER_SUPPORT_01_요청_접수 --> CUSTOMER_SUPPORT_02_개인정보_긴급도_분류["개인정보·긴급도 분류"]
  CUSTOMER_SUPPORT_02_개인정보_긴급도_분류 --> CUSTOMER_SUPPORT_03_담당자_배정["담당자 배정"]
  CUSTOMER_SUPPORT_03_담당자_배정 --> CUSTOMER_SUPPORT_04_조사_답변["조사·답변"]
  CUSTOMER_SUPPORT_04_조사_답변 --> CUSTOMER_SUPPORT_05_개발_운영_이관["개발·운영 이관"]
  CUSTOMER_SUPPORT_05_개발_운영_이관 --> CUSTOMER_SUPPORT_06_해결_확인["해결 확인"]
  CUSTOMER_SUPPORT_06_해결_확인 --> CUSTOMER_SUPPORT_07_종결_지식화["종결·지식화"]
  CUSTOMER_SUPPORT_07_종결_지식화 --> END_CUSTOMER_SUPPORT([완료])
```

## 메뉴·화면·API·DB 변경관리

```mermaid
flowchart LR
  START_GOVERNANCE_CHANGE([시작])
  START_GOVERNANCE_CHANGE --> GOVERNANCE_CHANGE_01_변경_요청["변경 요청"]
  GOVERNANCE_CHANGE_01_변경_요청 --> GOVERNANCE_CHANGE_02_요구_법령_근거_연결["요구·법령 근거 연결"]
  GOVERNANCE_CHANGE_02_요구_법령_근거_연결 --> GOVERNANCE_CHANGE_03_영향도_분석["영향도 분석"]
  GOVERNANCE_CHANGE_03_영향도_분석 --> GOVERNANCE_CHANGE_04_명세_테스트_생성["명세·테스트 생성"]
  GOVERNANCE_CHANGE_04_명세_테스트_생성 --> GOVERNANCE_CHANGE_05_승인["승인"]
  GOVERNANCE_CHANGE_05_승인 --> GOVERNANCE_CHANGE_06_구현_배포["구현·배포"]
  GOVERNANCE_CHANGE_06_구현_배포 --> GOVERNANCE_CHANGE_07_캐시_무효화["캐시 무효화"]
  GOVERNANCE_CHANGE_07_캐시_무효화 --> GOVERNANCE_CHANGE_08_운영_검증_복구["운영 검증·복구"]
  GOVERNANCE_CHANGE_08_운영_검증_복구 --> END_GOVERNANCE_CHANGE([완료])
```

## 시스템 운영·관측·복구

```mermaid
flowchart LR
  START_PLATFORM_OPERATION([시작])
  START_PLATFORM_OPERATION --> PLATFORM_OPERATION_01_상태_수집["상태 수집"]
  PLATFORM_OPERATION_01_상태_수집 --> PLATFORM_OPERATION_02_경보_분류["경보 분류"]
  PLATFORM_OPERATION_02_경보_분류 --> PLATFORM_OPERATION_03_장애_대응["장애 대응"]
  PLATFORM_OPERATION_03_장애_대응 --> PLATFORM_OPERATION_04_DB_백업_보호["DB·백업 보호"]
  PLATFORM_OPERATION_04_DB_백업_보호 --> PLATFORM_OPERATION_05_배포_롤백["배포·롤백"]
  PLATFORM_OPERATION_05_배포_롤백 --> PLATFORM_OPERATION_06_복구_검증["복구 검증"]
  PLATFORM_OPERATION_06_복구_검증 --> PLATFORM_OPERATION_07_사후_분석["사후 분석"]
  PLATFORM_OPERATION_07_사후_분석 --> PLATFORM_OPERATION_08_재발방지["재발방지"]
  PLATFORM_OPERATION_08_재발방지 --> END_PLATFORM_OPERATION([완료])
```

## 개인정보 열람·정정·삭제·처리정지

```mermaid
flowchart LR
  START_PRIVACY_RIGHTS([시작])
  START_PRIVACY_RIGHTS --> PRIVACY_RIGHTS_01_권리_요청["권리 요청"]
  PRIVACY_RIGHTS_01_권리_요청 --> PRIVACY_RIGHTS_02_본인확인["본인확인"]
  PRIVACY_RIGHTS_02_본인확인 --> PRIVACY_RIGHTS_03_대상_정보_검색["대상 정보 검색"]
  PRIVACY_RIGHTS_03_대상_정보_검색 --> PRIVACY_RIGHTS_04_법적_예외_검토["법적 예외 검토"]
  PRIVACY_RIGHTS_04_법적_예외_검토 --> PRIVACY_RIGHTS_05_승인_처리["승인·처리"]
  PRIVACY_RIGHTS_05_승인_처리 --> PRIVACY_RIGHTS_06_결과_통지["결과 통지"]
  PRIVACY_RIGHTS_06_결과_통지 --> PRIVACY_RIGHTS_07_증적_보존["증적 보존"]
  PRIVACY_RIGHTS_07_증적_보존 --> END_PRIVACY_RIGHTS([완료])
```

## 보안·개인정보 사고 대응

```mermaid
flowchart LR
  START_SECURITY_INCIDENT([시작])
  START_SECURITY_INCIDENT --> SECURITY_INCIDENT_01_탐지_신고["탐지·신고"]
  SECURITY_INCIDENT_01_탐지_신고 --> SECURITY_INCIDENT_02_분류_초동조치["분류·초동조치"]
  SECURITY_INCIDENT_02_분류_초동조치 --> SECURITY_INCIDENT_03_영향범위_조사["영향범위 조사"]
  SECURITY_INCIDENT_03_영향범위_조사 --> SECURITY_INCIDENT_04_접근차단_보존["접근차단·보존"]
  SECURITY_INCIDENT_04_접근차단_보존 --> SECURITY_INCIDENT_05_통지_신고_판단["통지·신고 판단"]
  SECURITY_INCIDENT_05_통지_신고_판단 --> SECURITY_INCIDENT_06_복구["복구"]
  SECURITY_INCIDENT_06_복구 --> SECURITY_INCIDENT_07_원인분석_재발방지["원인분석·재발방지"]
  SECURITY_INCIDENT_07_원인분석_재발방지 --> SECURITY_INCIDENT_08_감사["감사"]
  SECURITY_INCIDENT_08_감사 --> END_SECURITY_INCIDENT([완료])
```

## 감사·법정자료 제출

```mermaid
flowchart LR
  START_AUDIT_EXPORT([시작])
  START_AUDIT_EXPORT --> AUDIT_EXPORT_01_감사범위_권한_승인["감사범위·권한 승인"]
  AUDIT_EXPORT_01_감사범위_권한_승인 --> AUDIT_EXPORT_02_로그_증적_검색["로그·증적 검색"]
  AUDIT_EXPORT_02_로그_증적_검색 --> AUDIT_EXPORT_03_무결성_검증["무결성 검증"]
  AUDIT_EXPORT_03_무결성_검증 --> AUDIT_EXPORT_04_예외_위반_분석["예외·위반 분석"]
  AUDIT_EXPORT_04_예외_위반_분석 --> AUDIT_EXPORT_05_보고서_작성["보고서 작성"]
  AUDIT_EXPORT_05_보고서_작성 --> AUDIT_EXPORT_06_제출_열람통제["제출·열람통제"]
  AUDIT_EXPORT_06_제출_열람통제 --> AUDIT_EXPORT_07_보존_파기["보존·파기"]
  AUDIT_EXPORT_07_보존_파기 --> END_AUDIT_EXPORT([완료])
```
