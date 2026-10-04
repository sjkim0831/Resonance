import {render,screen,fireEvent,waitFor,cleanup} from '@testing-library/react';
import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {StepResourcesPanel} from './StepResourcesPanel';
import * as api from '../../lib/api/platform';
import {submitFormRequest} from '../admin-system/adminSystemShared';
vi.mock('../../lib/api/platform',()=>({fetchNewPagePage:vi.fn(),fetchFunctionManagementPage:vi.fn()}));
vi.mock('../admin-system/adminSystemShared',()=>({submitFormRequest:vi.fn()}));
const page={pageId:'P1',menuCode:'M1',canonicalMenuUrl:'/admin/example',requiredViewFeatureCode:'M1_VIEW',roleAssignments:[{authorCode:'ADMIN',authorName:'관리자',assigned:true}]};
beforeEach(()=>{vi.clearAllMocks();vi.mocked(api.fetchNewPagePage).mockResolvedValue(page);vi.mocked(api.fetchFunctionManagementPage).mockResolvedValue({featureRows:[{menuCode:'M1',featureCode:'M1_VIEW',featureNm:'조회',useAt:'Y'},{menuCode:'OTHER',featureCode:'OTHER_EDIT'}]});vi.mocked(submitFormRequest).mockResolvedValue(new Response('{}'));});
afterEach(cleanup);
async function open(){const selected=vi.fn();render(<StepResourcesPanel processCode="TEST" stepCode="S1" bindings={[{routePath:'/admin/example'},{routePath:'/admin/example'},{routePath:'//evil.test'}]} onPageSelected={selected}/>);fireEvent.click(screen.getByRole('button',{name:/페이지·기능·권한 연결/}));await screen.findByText('P1 / M1');return selected;}
it('정상 메뉴 페이지 조회 및 중복 외부 경로 제외',async()=>{await open();expect(screen.getAllByRole('option')).toHaveLength(1);expect(api.fetchNewPagePage).toHaveBeenCalledWith('/admin/example');});
it('선택 메뉴 기능만 표시',async()=>{await open();expect(screen.getByText(/조회 · M1_VIEW/)).toBeInTheDocument();expect(screen.queryByText(/OTHER_EDIT/)).toBeNull();});
it('VIEW 권한과 쓰기 권한 구분',async()=>{await open();expect(screen.getByText('관리자 · 조회 권한 연결')).toBeInTheDocument();expect(screen.getByText(/생성·수정·삭제 권한/)).toBeInTheDocument();});
it('정확한 페이지 ID로 공식 설계 편집 연결',async()=>{await open();expect(screen.getByRole('link',{name:'공식 화면 설계 편집'}).getAttribute('href')).toContain('pageId=P1');});
it('잘못된 메뉴 매핑시 편집 차단',async()=>{vi.mocked(api.fetchNewPagePage).mockResolvedValue({...page,canonicalMenuUrl:'/wrong'});render(<StepResourcesPanel processCode="TEST" stepCode="S1" bindings={[{routePath:'/admin/example'}]}/>);fireEvent.click(screen.getByRole('button'));await screen.findByRole('alert');expect(screen.queryByRole('link',{name:'공식 화면 설계 편집'})).toBeNull();});
async function fill(){await open();fireEvent.click(screen.getByText('이 페이지에 기능 등록'));fireEvent.change(screen.getByLabelText('기능 코드'),{target:{value:'M1_CREATE'}});fireEvent.change(screen.getByLabelText('기능명'),{target:{value:'등록'}});fireEvent.change(screen.getByLabelText('기능 설명'),{target:{value:'신규 등록'}});}
it('공식 저장 뒤 같은 메뉴 재조회 결과로 성공 판정',async()=>{await fill();vi.mocked(api.fetchFunctionManagementPage).mockResolvedValue({featureRows:[{menuCode:'M1',featureCode:'M1_CREATE',featureNm:'등록'}]});fireEvent.click(screen.getByText('기능 정의 저장'));await screen.findByText(/M1_CREATE 저장·재조회 완료/);expect(submitFormRequest).toHaveBeenCalledTimes(1);expect(api.fetchFunctionManagementPage).toHaveBeenLastCalledWith({menuType:'ADMIN',searchMenuCode:'M1'});});
it('저장 실패시 입력 보존',async()=>{await fill();vi.mocked(submitFormRequest).mockRejectedValue(new Error('403 권한 부족'));fireEvent.click(screen.getByText('기능 정의 저장'));await screen.findByRole('alert');expect(screen.getByLabelText('기능 코드')).toHaveValue('M1_CREATE');});
it('응답 성공만으로 저장 완료 판정하지 않음',async()=>{await fill();fireEvent.click(screen.getByText('기능 정의 저장'));await waitFor(()=>expect(screen.getByRole('alert')).toHaveTextContent('등록 결과를 확인하지 못했습니다'));expect(screen.queryByText(/M1_CREATE 저장·재조회 완료/)).toBeNull();});
