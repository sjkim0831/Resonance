// Reference-layout construction contracts, not manufacturer machine specifications.
const families={
 'fluid-skid':{base:'fluid',size:[3,2.1,1.7],components:['Frame','Pump','Tank','Pipe','Motor'],cost:3},
 'fluid-system-expanded':{base:'fluid',size:[3.2,2.2,1.8],components:['Frame','Pump','Tank','Pipe','Motor'],cost:4},
 'tank-vessel':{base:'vessel',size:[2.4,2,1.8],components:['Tank','Motor','Pipe','Plate'],cost:2},
 'power-cabinet':{base:'cabinet',size:[1.2,2.1,.65],components:['Plate','Box'],cost:2},
 'storage-cabinet':{base:'cabinet',size:[1,1.9,.65],components:['Plate','Box'],cost:2},
 'test-chamber':{base:'chamber',size:[1.8,2,1.5],components:['Plate','Box','Conveyor'],cost:3},
 'sensor-probe':{base:'sensor',size:[.16,.2,.12],components:['Probe','Box','Pipe'],cost:3},
 'flat-safety-module':{base:'panel',size:[1.2,1.6,.12],components:['Plate','Pipe'],cost:2},
 'access-structure':{base:'access',size:[1.3,2,.5],components:['Plate','Pipe','Frame'],cost:3},
 'flow-workstation':{base:'workstation',size:[2,1.8,1.2],components:['Frame','Conveyor','Probe','Box','Pipe'],cost:4},
 'linear-actuation':{base:'linear',size:[1,.3,.3],components:['Cylinder','Motor','Plate'],cost:2},
 'robot-top-module':{base:'mobile-top',size:[1,.65,.8],components:['Conveyor','Cylinder','Plate'],cost:3},
 'rotary-drive':{base:'rotary',size:[.7,.6,.5],components:['Motor','Gearbox','Pipe'],cost:3},
 'gravity-chute':{base:'chute',size:[2,1,1],components:['Plate'],cost:2},
 'storage-magazine':{base:'magazine',size:[.5,.4,.4],components:['Plate'],cost:2},
 'wash-booth':{base:'wash',size:[2.5,2.2,1.8],components:['Plate','Pump','Pipe','Tank'],cost:5},
 'service-cart':{base:'service',size:[.9,1.1,.65],components:['Cart','Pump','Tank','Pipe','Cylinder','Box'],cost:3},
 'roll-web-line':{base:'roll',size:[3,1.7,1.8],components:['Frame','Coil','Pipe','Motor','Plate'],cost:5}
};
// Each branch names a structural arrangement; blank or unknown falls back to HOLD, not a generic box.
function configuration(a){let f=families[a.family];if(!f)return null;let n=a.name,mode=f.base,features=[],count=2;
 if(mode==='fluid'){mode=/CIP|세정|냉각회로/.test(n)?'multi-tank':/PSA|질소|연수|퍼지|흡착|정제/.test(n)?'twin-column':/역삼투|한외|폴리싱|EDI|전기탈이온|막분리/.test(n)?'membrane':/열교환|살균|감온|응축|회수|멸균/.test(n)?'heat-loop':/매니폴드|전환|압력 조정|피깅/.test(n)?'manifold':'tank-pump';count=/2액|CIP|다유체|교환/.test(n)?3:2;features=['skid','pump','fluid-in','fluid-out',mode]}
 if(mode==='vessel'){mode=/집수|조$|도금조|도장조|담금질/.test(n)?'open-bath':'closed-vessel';features=[mode,/교반|반응|발효/.test(n)?'agitator':'lid','drain']}
 if(mode==='cabinet'){mode=a.family==='storage-cabinet'?'storage':'power';count=/모터 제어|중전압|정류/.test(n)?3:/대여/.test(n)?4:2;features=[mode,/냉장|온습도|PCS|인버터|고조파/.test(n)?'ventilation':'plain',/질소/.test(n)?'purge':'cable']}
 if(mode==='chamber'){mode=/터널|연속|리플로우|탈파이로젠/.test(n)?'tunnel':'batch';features=[mode,/열충격/.test(n)?'two-zone':/냉동|심냉/.test(n)?'cooling':'thermal']}
 if(mode==='sensor'){mode=/비전|카메라|바코드|광전|화염/.test(n)?'optical':/RFID/.test(n)?'rfid':/토크/.test(n)?'shaft':/유량|압력/.test(n)?'inline':/열유속/.test(n)?'pad':/가스|입자/.test(n)?'sampling':'probe';count=/3D/.test(n)?2:1;features=[mode,'connector','mount']}
 if(mode==='panel'){mode=/매트/.test(n)?'mat':/범퍼|보호대/.test(n)?'bumper':/커튼/.test(n)?'curtain':'hatch';features=[mode,'mount']}
 if(mode==='access'){mode=/사다리/.test(n)?'ladder':/도크/.test(n)?'dock':/테이블/.test(n)?'table':/천장/.test(n)?'ceiling-filter':'air-curtain';features=[mode,'mount']}
 if(mode==='workstation'){mode=/압력|내압|밸브|유량|누설/.test(n)?'test-bench':/전기|프로그램|OCV/.test(n)?'electrical-test':/키팅|피킹/.test(n)?'kitting':/체적|빈 팔레트/.test(n)?'portal':'optical-bench';features=[mode,'workpiece-in','workpiece-out','fixture','sensor-mount']}
 if(mode==='linear'){mode=/실린더/.test(n)?'cylinder':/잭/.test(n)?'jack':/클램핑/.test(n)?'clamp':'rail';features=[mode,'fixed-mount','output-mount']}
 if(mode==='mobile-top'){mode=/롤러/.test(n)?'roller':/체결/.test(n)?'coupler':'lift';features=[mode,'deck-mount']}
 if(mode==='rotary'){mode=/윈치/.test(n)?'winch':/진동/.test(n)?'vibrator':'actuator';features=[mode,'drive-output','fixed-mount']}
 if(mode==='wash'){mode=/고압|드라이아이스|레이저/.test(n)?'portable':/초음파|코어/.test(n)?'wash-bath':/스크러버/.test(n)?'scrubber':/재생|바이알|린서|빈 세척|바퀴/.test(n)?'wash-line':'booth';features=[mode,'feed','drain','exhaust']}
 if(mode==='service'){mode=/풀러/.test(n)?'puller':/텐셔너/.test(n)?'tensioner':/열풍/.test(n)?'heat-tool':/청소/.test(n)?'vacuum':/음수/.test(n)?'dispenser':'cart-pump';features=[mode,'service-mount']}
 if(mode==='roll'){mode=/권선|권취|와인딩|트위스팅|테이핑|코일링/.test(n)?'winder':/슬롯다이|라미네이팅/.test(n)?'coating':'roll-bank';count=/롤포밍|레벨러|드로잉/.test(n)?6:3;features=[mode,'web-in','web-out','drive']}
 let size=[...f.size];if(['mat','pad'].includes(mode))size[1]=.03;if(mode==='ladder')size=[.6,3,.15];if(mode==='air-curtain')size=[1.5,.3,.3];if(mode==='ceiling-filter')size=[1.2,.3,.6];if(mode==='dock')size=[3.2,3.5,.6];if(mode==='table')size=[1.5,.85,.8];if(mode==='hatch')size=[1.2,.15,1.2];if(mode==='rail')size=[1.5,.22,.22];if(mode==='tunnel')size=[4,1.8,1.5];if(mode==='portable')size=[.8,1,.6];if(mode==='heat-tool')size=[.3,.22,.08];if(mode==='tensioner')size=[.15,.2,.15];if(mode==='puller')size=[.6,.5,.4];
 return{family:a.family,base:f.base,mode,features,count,size,components:f.components,cost:f.cost,scope:'REFERENCE_LAYOUT_COMPOSITION_NOT_FUNCTIONAL',dimensionBasis:'P006-BULK-REFERENCE-1: project design envelope, not measured manufacturer size',mountPolicy:a.category==='MODULE_LINK'?'PARENT_ANCHOR':'FLOOR_REFERENCE',actualDataVerified:false};
}
module.exports={families,configuration,version:'P006-BULK-REFERENCE-1'};
