# P006 Equipment → 3D Asset 최종 매핑

- Equipment Type: **16**
- Equipment Instance: **0**
- Asset Catalog: **724**

## 집계

- CONNECTED: 0
- CANDIDATE: 5
- UNASSIGNED: 11
- EXACT_MATCH: 0
- CLOSE_MATCH: 3
- REFERENCE_MATCH: 2
- MULTIPLE: 0
- NO_MATCH: 6
- BLOCKED: 5
- GENERATED_CONCEPTUAL 사용: 0
- 보수적 연결률: 0/16 = 0.00%

## 최종 목록

| No | Equipment ID | Equipment Name | Asset ID | Asset Name | Match | Connection | USD | Evidence |
|---:|---|---|---|---|---|---|---|---|
| 1 | casting_machine | 주조기 | - | - | NO_MATCH | UNASSIGNED | `-` | EQUIPMENT_MASTER:/opt/Resonance/projects/P006/frontend/equipment-master.json; DB_SCENARIO_CODE:woosu_digital_twin.dt_simulation_scenario; REPRESENTATIVE_RENDER_VISUALLY_REVIEWED:/opt/Resonance/projects/P006/frontend/equipment/casting-machine.jpg; PRIOR_DIMENSION_RECORD_NOT_REAUDITED:/home/sjkim/OmniverseProjects/equipment-dimension-profiles.json |
| 2 | holding_furnace | 보온로 | - | - | NO_MATCH | UNASSIGNED | `-` | EQUIPMENT_MASTER:/opt/Resonance/projects/P006/frontend/equipment-master.json; DB_SCENARIO_CODE:woosu_digital_twin.dt_simulation_scenario; REPRESENTATIVE_RENDER_VISUALLY_REVIEWED:/opt/Resonance/projects/P006/frontend/equipment/holding-furnace.jpg; PRIOR_DIMENSION_RECORD_NOT_REAUDITED:/home/sjkim/OmniverseProjects/equipment-dimension-profiles.json |
| 3 | turntable_furnace | 턴테이블로 | - | - | NO_MATCH | UNASSIGNED | `-` | EQUIPMENT_MASTER:/opt/Resonance/projects/P006/frontend/equipment-master.json; DB_SCENARIO_CODE:woosu_digital_twin.dt_simulation_scenario; REPRESENTATIVE_RENDER_VISUALLY_REVIEWED:/opt/Resonance/projects/P006/frontend/equipment/turntable-furnace.jpg; PRIOR_DIMENSION_RECORD_NOT_REAUDITED:/home/sjkim/OmniverseProjects/equipment-dimension-profiles.json |
| 4 | trimming_machine | 트리밍 | - | - | BLOCKED | UNASSIGNED | `-` | EQUIPMENT_MASTER:/opt/Resonance/projects/P006/frontend/equipment-master.json; DB_SCENARIO_CODE:woosu_digital_twin.dt_simulation_scenario; REPRESENTATIVE_RENDER_VISUALLY_REVIEWED:/opt/Resonance/projects/P006/frontend/equipment/trimming-machine.jpg; PRIOR_DIMENSION_RECORD_NOT_REAUDITED:/home/sjkim/OmniverseProjects/equipment-dimension-profiles.json |
| 5 | cooling_unit | 냉각장비 | - | - | BLOCKED | UNASSIGNED | `-` | EQUIPMENT_MASTER:/opt/Resonance/projects/P006/frontend/equipment-master.json; DB_SCENARIO_CODE:woosu_digital_twin.dt_simulation_scenario; REPRESENTATIVE_RENDER_VISUALLY_REVIEWED:/opt/Resonance/projects/P006/frontend/equipment/cooling-unit.jpg; PRIOR_DIMENSION_RECORD_NOT_REAUDITED:/home/sjkim/OmniverseProjects/equipment-dimension-profiles.json |
| 6 | robot_panel | 로봇 제어반 | - | - | NO_MATCH | UNASSIGNED | `-` | EQUIPMENT_MASTER:/opt/Resonance/projects/P006/frontend/equipment-master.json; DB_SCENARIO_CODE:woosu_digital_twin.dt_simulation_scenario; REPRESENTATIVE_RENDER_VISUALLY_REVIEWED:/opt/Resonance/projects/P006/frontend/equipment/robot-panel.jpg; PRIOR_DIMENSION_RECORD_NOT_REAUDITED:/home/sjkim/OmniverseProjects/equipment-dimension-profiles.json |
| 7 | spray_ladler | 스프레이 로봇·래들 | - | - | BLOCKED | UNASSIGNED | `-` | EQUIPMENT_MASTER:/opt/Resonance/projects/P006/frontend/equipment-master.json; DB_SCENARIO_CODE:woosu_digital_twin.dt_simulation_scenario; REPRESENTATIVE_RENDER_VISUALLY_REVIEWED:/opt/Resonance/projects/P006/frontend/equipment/spray-ladler.jpg; PRIOR_DIMENSION_RECORD_NOT_REAUDITED:/home/sjkim/OmniverseProjects/equipment-dimension-profiles.json |
| 8 | release_agent | 이형제 장치 | - | - | NO_MATCH | UNASSIGNED | `-` | EQUIPMENT_MASTER:/opt/Resonance/projects/P006/frontend/equipment-master.json; DB_SCENARIO_CODE:woosu_digital_twin.dt_simulation_scenario; REPRESENTATIVE_RENDER_VISUALLY_REVIEWED:/opt/Resonance/projects/P006/frontend/equipment/release-agent.jpg; PRIOR_DIMENSION_RECORD_NOT_REAUDITED:/home/sjkim/OmniverseProjects/equipment-dimension-profiles.json |
| 9 | main_panel | 전체 제어반 | - | - | NO_MATCH | UNASSIGNED | `-` | EQUIPMENT_MASTER:/opt/Resonance/projects/P006/frontend/equipment-master.json; DB_SCENARIO_CODE:woosu_digital_twin.dt_simulation_scenario; REPRESENTATIVE_RENDER_VISUALLY_REVIEWED:/opt/Resonance/projects/P006/frontend/equipment/main-panel.jpg; PRIOR_DIMENSION_RECORD_NOT_REAUDITED:/home/sjkim/OmniverseProjects/equipment-dimension-profiles.json |
| 10 | vacuum_unit | 진공장치 | E194 | 진공 펌프 패키지 | REFERENCE_MATCH | CANDIDATE | `/home/sjkim/OmniverseProjects/assets/catalog/E194.usda` | EQUIPMENT_MASTER:/opt/Resonance/projects/P006/frontend/equipment-master.json; DB_SCENARIO_CODE:woosu_digital_twin.dt_simulation_scenario; REPRESENTATIVE_RENDER_VISUALLY_REVIEWED:/opt/Resonance/projects/P006/frontend/equipment/vacuum-unit.jpg; PRIOR_DIMENSION_RECORD_NOT_REAUDITED:/home/sjkim/OmniverseProjects/equipment-dimension-profiles.json; USD_RENDER_VISUALLY_REVIEWED:/opt/Resonance/projects/P006/frontend/visual-catalog/images/E194.png |
| 11 | casting_filter | 주조기 필터 | - | - | BLOCKED | UNASSIGNED | `-` | EQUIPMENT_MASTER:/opt/Resonance/projects/P006/frontend/equipment-master.json; DB_SCENARIO_CODE:woosu_digital_twin.dt_simulation_scenario; REPRESENTATIVE_RENDER_VISUALLY_REVIEWED:/opt/Resonance/projects/P006/frontend/equipment/casting-filter.jpg; PRIOR_DIMENSION_RECORD_NOT_REAUDITED:/home/sjkim/OmniverseProjects/equipment-dimension-profiles.json |
| 12 | melting_furnace | 용해로 | E005 | 용해로/가열로 | CLOSE_MATCH | CANDIDATE | `/home/sjkim/OmniverseProjects/assets/catalog/E005.usda` | EQUIPMENT_MASTER:/opt/Resonance/projects/P006/frontend/equipment-master.json; DB_SCENARIO_CODE:woosu_digital_twin.dt_simulation_scenario; REPRESENTATIVE_RENDER_VISUALLY_REVIEWED:/opt/Resonance/projects/P006/frontend/equipment/melting-furnace.jpg; PRIOR_DIMENSION_RECORD_NOT_REAUDITED:/home/sjkim/OmniverseProjects/equipment-dimension-profiles.json; USD_RENDER_VISUALLY_REVIEWED:/opt/Resonance/projects/P006/frontend/visual-catalog/images/E005.png |
| 13 | takeout_robot | 취출 로봇 | E004 | 취출 로봇 | CLOSE_MATCH | CANDIDATE | `/home/sjkim/OmniverseProjects/assets/catalog/E004.usda` | EQUIPMENT_MASTER:/opt/Resonance/projects/P006/frontend/equipment-master.json; DB_SCENARIO_CODE:woosu_digital_twin.dt_simulation_scenario; REPRESENTATIVE_RENDER_VISUALLY_REVIEWED:/opt/Resonance/projects/P006/frontend/equipment/takeout-robot.jpg; PRIOR_DIMENSION_RECORD_NOT_REAUDITED:/home/sjkim/OmniverseProjects/equipment-dimension-profiles.json; USD_RENDER_VISUALLY_REVIEWED:/opt/Resonance/projects/P006/frontend/visual-catalog/images/E004.png |
| 14 | punching_press | 펀칭 프레스 | E001 | 트리밍 장비 | CLOSE_MATCH | CANDIDATE | `/home/sjkim/OmniverseProjects/assets/catalog/E001.usda` | EQUIPMENT_MASTER:/opt/Resonance/projects/P006/frontend/equipment-master.json; DB_SCENARIO_CODE:woosu_digital_twin.dt_simulation_scenario; REPRESENTATIVE_RENDER_VISUALLY_REVIEWED:/opt/Resonance/projects/P006/frontend/equipment/punching-press.jpg; PRIOR_DIMENSION_RECORD_NOT_REAUDITED:/home/sjkim/OmniverseProjects/equipment-dimension-profiles.json; USD_RENDER_VISUALLY_REVIEWED:/opt/Resonance/projects/P006/frontend/visual-catalog/images/E001.png |
| 15 | ladler | 래들러 | E002 | 주탕 로봇 | REFERENCE_MATCH | CANDIDATE | `/home/sjkim/OmniverseProjects/assets/catalog/E002.usda` | EQUIPMENT_MASTER:/opt/Resonance/projects/P006/frontend/equipment-master.json; DB_SCENARIO_CODE:woosu_digital_twin.dt_simulation_scenario; REPRESENTATIVE_RENDER_VISUALLY_REVIEWED:/opt/Resonance/projects/P006/frontend/equipment/ladler.jpg; PRIOR_DIMENSION_RECORD_NOT_REAUDITED:/home/sjkim/OmniverseProjects/equipment-dimension-profiles.json; USD_RENDER_VISUALLY_REVIEWED:/opt/Resonance/projects/P006/frontend/visual-catalog/images/E002.png |
| 16 | mold_cooling | 금형 고압냉각장비 | - | - | BLOCKED | UNASSIGNED | `-` | EQUIPMENT_MASTER:/opt/Resonance/projects/P006/frontend/equipment-master.json; DB_SCENARIO_CODE:woosu_digital_twin.dt_simulation_scenario; REPRESENTATIVE_RENDER_VISUALLY_REVIEWED:/opt/Resonance/projects/P006/frontend/equipment/mold-cooling.jpg; PRIOR_DIMENSION_RECORD_NOT_REAUDITED:/home/sjkim/OmniverseProjects/equipment-dimension-profiles.json |

## 판정 원칙

실제 업체·제조사·모델·Equipment Instance가 없으므로 이름 유사성만으로 CONNECTED 처리하지 않았다. 기존 추천 5개는 승인·실물 검증 전 CANDIDATE로 유지했다. GENERATED/CONCEPTUAL 자산은 이번 16개 후보에서 기능·형상 근거가 부족해 사용하지 않았다.

원본 `mapping.json`과 724개 Asset/ USD는 수정하지 않았다.