package egovframework.com.feature.admin.service.impl;

final class EmissionCalculationUiDefinitionFactory {
    private EmissionCalculationUiDefinitionFactory() {
    }

    private static VariableSectionDefinition section(String id, int order, String title, String description, String formula) {
        return new VariableSectionDefinition(id, order, title, description, formula, "", "");
    }

    private static VariableSectionDefinition section(String id, int order, String title, String description, String formula, String previewType) {
        return new VariableSectionDefinition(id, order, title, description, formula, previewType, "");
    }

    private static VariableSectionDefinition section(String id, int order, String title, String description, String formula, String previewType, String relatedFactorCodes) {
        return new VariableSectionDefinition(id, order, title, description, formula, previewType, relatedFactorCodes);
    }

    static VariableUiDefinition cementTier1() {
        VariableSectionDefinition clinkerSection = section(
                "cement-tier1-clinker",
                1,
                "클링커 활동자료 입력",
                "각 행별로 시멘트 생산량(Mci)과 클링커 함량(Ccli)을 함께 입력합니다.",
                "산정식: Mci × Ccli"
        );
        VariableSectionDefinition adjustmentSection = section(
                "cement-tier1-adjustment",
                2,
                "보정 활동자료 입력",
                "수입 클링커(Im)와 수출 클링커(Ex)를 입력해 총 클링커 생산량을 보정합니다.",
                "산정식: Σ(Mci × Ccli) - Im + Ex"
        );
        VariableSectionDefinition factorSection = section(
                "cement-tier1-factor",
                3,
                "배출계수 입력",
                "EFclc를 직접 입력하지 않으면 저장 계수 또는 기본 계수를 사용합니다.",
                "산정식: [Σ(Mci × Ccli) - Im + Ex] × EFclc",
                "",
                "EFCLC"
        );
        return VariableUiDefinition.builder()
                .displayCode("MCI", "Mci")
                .displayCode("CCLI", "Ccli")
                .displayCode("IM", "Im")
                .displayCode("EX", "Ex")
                .displayCode("EFCLC", "EFclc")
                .groupedSection("cement-tier1-clinker", clinkerSection, "MCI", "CCLI")
                .section(adjustmentSection, "IM", "EX")
                .section(factorSection, "EFCLC")
                .build();
    }

    static VariableUiDefinition cementTier2() {
        VariableSectionDefinition productionSection = section(
                "cement-tier2-production",
                1,
                "기본 활동자료 입력",
                "시멘트 생산량(Mcl)을 입력합니다.",
                "산정식: Mcl"
        );
        VariableSectionDefinition correctionSection = section(
                "cement-tier2-correction",
                2,
                "CFckd 산정 입력",
                "Md, Cd, Fd와 계수 항목을 함께 관리해 CFckd 또는 기본/저장 계수를 적용합니다.",
                "산정식: CFckd = 1 + (Md / Mcl) × Cd × Fd × (EFc / EFcl)",
                "cement-tier2-cf",
                "EFC,EFCL,CFCKD"
        );
        return VariableUiDefinition.builder()
                .displayCode("MCL", "Mcl")
                .displayCode("MD", "Md")
                .displayCode("CD", "Cd")
                .displayCode("FD", "Fd")
                .displayCode("EFC", "EFc")
                .displayCode("EFCL", "EFcl")
                .displayCode("CFCKD", "CFckd")
                .supplemental("MD", "CD", "FD", "EFC", "EFCL", "CFCKD")
                .uiHint("MD", "문서 기준 원입력값입니다. CKD 질량 보정이 있으면 CFckd 유도식에 사용하고, 비워두면 저장 계수 또는 기본값 흐름으로 전환됩니다.")
                .uiHint("CD", "문서 기준 원입력값입니다. CKD의 원래 탄산염 비율이며, 비워두면 CFckd는 직접 입력값 또는 저장/기본 계수를 사용합니다.")
                .uiHint("FD", "문서 기준 원입력값입니다. CKD 소성 비율이며, 비워두면 CFckd는 직접 입력값 또는 저장/기본 계수를 사용합니다.")
                .uiHint("EFC", "문서 기준 계수 항목입니다. 직접 입력이 없으면 저장 계수 0.4397 또는 기본 계수로 보완됩니다.")
                .uiHint("EFCL", "문서 기준 계수 항목입니다. 직접 입력이 없으면 저장 계수 0.51 또는 기본 계수로 보완됩니다.")
                .uiHint("CFCKD", "Md, Cd, Fd, EFc, EFcl이 모두 있으면 유도식으로 계산하고, 부족하면 저장 계수 또는 기본값 1.02를 사용합니다.")
                .section(productionSection, "MCL")
                .section(correctionSection, "MD", "CD", "FD", "EFC", "EFCL", "CFCKD")
                .build();
    }

    static VariableUiDefinition cementTier3() {
        VariableSectionDefinition carbonateSection = section(
                "cement-tier3-carbonate",
                1,
                "탄산염 활동자료 입력",
                "각 행별로 탄산염 종류, 질량(Mi), 소성 비율(Fi)을 함께 입력합니다.",
                "산정식: EFi × Mi × Fi"
        );
        VariableSectionDefinition ckdSection = section(
                "cement-tier3-ckd",
                2,
                "CKD 보정 입력",
                "손실 CKD 탄산염 종류와 Md, Cd, Fd를 입력해 CKD 보정값을 계산합니다.",
                "산정식: Md × Cd × (1 - Fd) × EFd",
                "",
                "EFD"
        );
        VariableSectionDefinition rawMaterialSection = section(
                "cement-tier3-raw-material",
                3,
                "원료 보정 입력",
                "각 행별로 원료 탄산염 종류, 질량(Mk), 탄소 비율(Xk)을 함께 입력합니다.",
                "산정식: Mk × Xk × EFk"
        );
        return VariableUiDefinition.builder()
                .displayName("CARBONATE_TYPE", "탄산염 종류")
                .displayName("LKD_CARBONATE_TYPE", "손실 CKD 탄산염 종류")
                .displayName("RAW_MATERIAL_CARBONATE_TYPE", "원료 탄산염 종류")
                .displayName("MD", "비재활용 CKD 질량")
                .displayName("CD", "비재활용 CKD 원래 탄산염 비율")
                .displayName("FD", "비재활용 CKD 소성 비율")
                .displayName("MK", "원료 질량")
                .displayName("XK", "원료 탄소 비율")
                .displayCode("CARBONATE_TYPE", "EFi")
                .displayCode("MI", "Mi")
                .displayCode("FI", "Fi")
                .displayCode("LKD_CARBONATE_TYPE", "EFd")
                .displayCode("MD", "Md")
                .displayCode("CD", "Cd")
                .displayCode("FD", "Fd")
                .displayCode("RAW_MATERIAL_CARBONATE_TYPE", "EFk")
                .displayCode("MK", "Mk")
                .displayCode("XK", "Xk")
                .derived("EFI", "EFK")
                .groupedSection("cement-tier3-carbonate", carbonateSection, "CARBONATE_TYPE", "MI", "FI", "EFI")
                .section(ckdSection, "LKD_CARBONATE_TYPE", "MD", "CD", "FD")
                .groupedSection("cement-tier3-raw-material", rawMaterialSection, "RAW_MATERIAL_CARBONATE_TYPE", "MK", "XK", "EFK")
                .build();
    }

    static VariableUiDefinition limeTier1() {
        VariableSectionDefinition productionSection = section(
                "lime-tier1-production",
                1,
                "기본 활동자료 입력",
                "각 행별로 석회 유형과 석회 생산량(Ml,i)을 함께 입력합니다.",
                "산정식: EF석회,i × Ml,i"
        );
        return VariableUiDefinition.builder()
                .displayName("LIME_TYPE", "EF석회,i 유형")
                .displayCode("LIME_TYPE", "EF석회,i")
                .displayCode("MLI", "Ml,i")
                .groupedSection("lime-tier1-production", productionSection, "LIME_TYPE", "MLI")
                .build();
    }

    static VariableUiDefinition limeTier2() {
        VariableSectionDefinition productionSection = section(
                "lime-tier2-production",
                1,
                "기본 활동자료 입력",
                "각 행별로 석회 유형과 석회 생산량(Ml,i)을 입력합니다.",
                "사용자 입력: 석회 유형, Ml,i"
        );
        VariableSectionDefinition efSection = section(
                "lime-tier2-ef",
                2,
                "EF석회,i 산정 입력",
                "조성 입력값을 입력하면 EF석회,a, EF석회,b, EF석회,c와 적용 EF석회,i를 아래 미리보기에서 즉시 확인할 수 있습니다.",
                "산정식: EF석회,a = SR_CAO × CaO, EF석회,b = SR_CAO·MgO × (CaO·MgO), EF석회,c = SR_CAO × CaO",
                "lime-tier2-ef",
                "EF_LIME,SR_CAO,SR_CAO_MGO"
        );
        VariableSectionDefinition cfSection = section(
                "lime-tier2-cf",
                3,
                "CF_lkd,i 산정 입력",
                "Md, Cd, Fd를 입력하면 아래 미리보기에서 CF_lkd,i 값을 즉시 확인할 수 있습니다.",
                "산정식: CF_lkd,i = 1 + (Md / Ml,i) × Cd × Fd",
                "lime-tier2-cf",
                "CF_LKD"
        );
        VariableSectionDefinition chSection = section(
                "lime-tier2-ch",
                4,
                "C_h,i 산정 입력",
                "수화석회 생산 여부와 x, y를 입력하면 아래 미리보기에서 C_h,i 값을 즉시 확인할 수 있습니다.",
                "산정식: C_h,i = 1 - (x × y), 또는 조건별 문서 기본값",
                "lime-tier2-ch",
                "C_H"
        );
        return VariableUiDefinition.builder()
                .displayName("LIME_TYPE", "석회 유형")
                .displayName("MLI", "석회 생산량")
                .displayName("CAO_CONTENT", "CaO 함유량")
                .displayName("CAO_MGO_CONTENT", "CaO·MgO 함유량")
                .displayName("MD", "LKD 질량")
                .displayName("CD", "LKD 원래 탄산염 비율")
                .displayName("FD", "LKD 소성 비율")
                .displayName("X", "수화석회 비율")
                .displayName("Y", "석회 수분 함유량")
                .displayName("HYDRATED_LIME_PRODUCTION_YN", "수화석회 생산 여부")
                .displayCode("LIME_TYPE", "EFi")
                .displayCode("MLI", "Ml,i")
                .displayCode("CAO_CONTENT", "CAO")
                .displayCode("CAO_MGO_CONTENT", "CaO·MgO")
                .displayCode("MD", "Md")
                .displayCode("CD", "Cd")
                .displayCode("FD", "Fd")
                .displayCode("HYDRATED_LIME_PRODUCTION_YN", "HYDRATED_YN")
                .displayCode("X", "x")
                .displayCode("Y", "y")
                .supplemental("CAO_CONTENT", "CAO_MGO_CONTENT", "MD", "CD", "FD", "HYDRATED_LIME_PRODUCTION_YN", "X", "Y")
                .uiHint("CAO_CONTENT", "문서 기준 원입력값입니다. EF석회,a 또는 EF석회,c 산정에 사용하며, 비워두면 표 2.4 기본 함유량을 사용합니다.")
                .uiHint("CAO_MGO_CONTENT", "문서 기준 원입력값입니다. 고토석회에서는 EF석회,b 산정에 우선 사용하며, 비워두면 표 2.4 기본 함유량을 사용합니다.")
                .uiHint("MD", "문서 기준 원입력값입니다. CF_lkd,i 산정에 사용합니다.")
                .uiHint("CD", "문서 기준 원입력값입니다. CF_lkd,i 산정에 사용합니다.")
                .uiHint("FD", "문서 기준 원입력값입니다. CF_lkd,i 산정에 사용합니다.")
                .uiHint("X", "문서 기준 원입력값입니다. 수화석회를 생산할 때 C_h,i 산정에 사용합니다.")
                .uiHint("Y", "문서 기준 원입력값입니다. 수화석회를 생산할 때 C_h,i 산정에 사용합니다.")
                .uiHint("HYDRATED_LIME_PRODUCTION_YN", "문서 기준 선택값입니다. C_h,i에 1.00, 0.97, 또는 1-(x×y) 중 무엇을 적용할지 결정합니다.")
                .visibleWhen("CAO_CONTENT", "LIME_TYPE in BLANK|HIGH_CALCIUM|HYDRAULIC")
                .visibleWhen("CAO_MGO_CONTENT", "LIME_TYPE in DOLOMITIC|DOLOMITIC_HIGH|DOLOMITIC_LOW")
                .disabledWhen("CAO_MGO_CONTENT", "LIME_TYPE notin DOLOMITIC|DOLOMITIC_HIGH|DOLOMITIC_LOW")
                .disabledWhen("X", "HYDRATED_LIME_PRODUCTION_YN=N")
                .disabledWhen("Y", "HYDRATED_LIME_PRODUCTION_YN=N")
                .repeatGroup("lime-tier2-line", "LIME_TYPE", "MLI", "CAO_CONTENT", "CAO_MGO_CONTENT", "MD", "CD", "FD", "HYDRATED_LIME_PRODUCTION_YN", "X", "Y")
                .section(productionSection, "LIME_TYPE", "MLI")
                .section(efSection, "CAO_CONTENT", "CAO_MGO_CONTENT")
                .section(cfSection, "MD", "CD", "FD")
                .section(chSection, "HYDRATED_LIME_PRODUCTION_YN", "X", "Y")
                .build();
    }

    static VariableUiDefinition limeTier3() {
        VariableSectionDefinition carbonateSection = section(
                "lime-tier3-carbonate",
                1,
                "탄산염 활동자료 입력",
                "각 행별로 탄산염 종류, 질량(Mi), 소성 비율(Fi)을 함께 입력합니다.",
                "산정식: EFi × Mi × Fi"
        );
        VariableSectionDefinition lkdSection = section(
                "lime-tier3-lkd",
                2,
                "LKD 보정 입력",
                "LKD 탄산염 종류와 Md, Cd, Fd를 입력해 LKD 보정값을 계산합니다.",
                "산정식: Md × Cd × (1 - Fd) × EFd",
                "",
                "EFD"
        );
        return VariableUiDefinition.builder()
                .displayName("CARBONATE_TYPE", "탄산염 종류")
                .displayName("MI", "탄산염 질량")
                .displayName("FI", "소성 비율")
                .displayName("LKD_CARBONATE_TYPE", "LKD 탄산염 종류")
                .displayName("MD", "LKD 질량")
                .displayName("CD", "LKD 원래 탄산염 비율")
                .displayName("FD", "LKD 소성 비율")
                .displayCode("CARBONATE_TYPE", "EFi")
                .displayCode("MI", "Mi")
                .displayCode("FI", "Fi")
                .displayCode("LKD_CARBONATE_TYPE", "EFd")
                .displayCode("MD", "Md")
                .displayCode("CD", "Cd")
                .displayCode("FD", "Fd")
                .derived("EFI")
                .groupedSection("lime-tier3-carbonate", carbonateSection, "CARBONATE_TYPE", "MI", "FI", "EFI")
                .section(lkdSection, "LKD_CARBONATE_TYPE", "MD", "CD", "FD")
                .build();
    }
}
