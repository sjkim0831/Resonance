import { render, screen, fireEvent } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { StudioDesignViews } from './StudioDesignViews';
vi.mock('./BoundScreenActions', () => ({ BoundScreenActions: () => null }));
const type = {workTypeCode:'TEST',workTypeName:'테스트 업무'};
const process = {processCode:'P',processName:'테스트 프로세스',processVersion:'7'};
const step = {stepCode:'S1',stepName:'테스트 등록',stepOrder:1,actorCode:'ADMIN',inputContract:{required:['name']},outputContract:{produces:['projectId']},completionRule:'저장 후 재조회',screenBindings:[{routePath:'/fixture',screenName:'테스트 화면'},{routePath:'/fixture',screenName:'중복 바인딩'}]};
function setup(extra = {}) { const props = {rows:[{type,process,step}],processes:[process],selectedProcessCode:'P',selectedStepCode:'S1',flowEdges:[],flowError:'',revisionHistory:[],revisionLoading:false,revisionError:'',onViewChange:vi.fn(),onProcessSelect:vi.fn(),onStepSelect:vi.fn(),onEdit:vi.fn(),...extra}; render(<StudioDesignViews {...props}/>); return props; }
it('선택 업무의 실제 입출력과 완료 조건 표시',()=>{ setup(); expect(screen.getByText('필수: name')).toBeTruthy(); expect(screen.getByText('생성 결과: 프로젝트 ID')).toBeTruthy(); expect(screen.getByText('저장 후 재조회')).toBeTruthy(); expect(screen.getByText('관리자')).toBeTruthy(); });
it('실제 연결 화면을 중복 없이 표시',()=>{setup(); expect(screen.getAllByRole('link',{name:'테스트 화면 ↗'})).toHaveLength(1);});
it('선택 절차로 공식 편집 연결',()=>{const p=setup(); fireEvent.click(screen.getByRole('button',{name:/설계 수정/})); expect(p.onEdit).toHaveBeenCalledWith('P','S1');});
it('업무 트리 선택 전달',()=>{const p=setup();fireEvent.click(screen.getByRole('button',{name:'테스트 프로세스'}));expect(p.onProcessSelect).toHaveBeenCalledWith('P');});
it('절차 선택 전달',()=>{const p=setup();fireEvent.change(screen.getByLabelText('업무 단계 선택'),{target:{value:'S1'}});expect(p.onStepSelect).toHaveBeenCalledWith('P','S1');});
it('상태 근거 없으면 미확인 표시',()=>{setup();expect(screen.getByText('검증: 미확인')).toBeTruthy();expect(screen.queryByText('60%')).toBeNull();});
it('업무 흐름 탭 즉시 연결',()=>{setup();fireEvent.click(screen.getByRole('button',{name:'업무 흐름'}));expect(screen.getByRole('region',{name:'업무 흐름도'})).toBeTruthy();});
it('화면 지도 탭 즉시 연결',()=>{setup();fireEvent.click(screen.getByRole('button',{name:'화면 지도'}));expect(screen.getByRole('region',{name:'화면 연결 지도'})).toBeTruthy();});
it('변경 비교 탭 즉시 연결',()=>{setup();fireEvent.click(screen.getByRole('button',{name:'변경 비교'}));expect(screen.getByRole('region',{name:'설계 변경 비교'})).toBeTruthy();});
it('빈 카탈로그에 가짜 업무 생성하지 않음',()=>{setup({rows:[],processes:[]});expect(screen.getByText('업무와 절차를 선택하세요.')).toBeTruthy();});
