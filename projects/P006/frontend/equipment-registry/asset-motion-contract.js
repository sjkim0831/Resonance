(function(root){
  'use strict';
  var TYPES = ['ROTATION','LINEAR','CONVEYOR','VALVE_OPEN_CLOSE','ROBOT_SEQUENCE'];
  function validate(input){
    var x=input||{};
    if(!x.assetId) throw Error('MOTION_ASSET_ID_REQUIRED');
    if(x.motionSupported!==true) return Object.assign({},x,{motionSupported:false,motionSource:null,state:'ASSET_MOTION_NOT_AVAILABLE'});
    if(!TYPES.includes(x.motionType)) throw Error('MOTION_TYPE_UNSUPPORTED');
    if(x.motionSource!=='GLB_ANIMATION'&&x.motionSource!=='USD/OMNIVERSE') throw Error('MOTION_SOURCE_REQUIRED');
    if(x.motionSource==='GLB_ANIMATION'&&!x.animationClipName) throw Error('ANIMATION_CLIP_NAME_REQUIRED');
    if(!Number.isFinite(Number(x.duration))||Number(x.duration)<=0) throw Error('MOTION_DURATION_INVALID');
    if(typeof x.loop!=='boolean') throw Error('MOTION_LOOP_REQUIRED');
    if(!Number.isFinite(Number(x.defaultSpeed))||Number(x.defaultSpeed)<=0) throw Error('MOTION_SPEED_INVALID');
    return Object.assign({targetNode:null,state:'STOPPED'},x,{duration:Number(x.duration),defaultSpeed:Number(x.defaultSpeed)});
  }
  function fromGLTF(assetId,gltf,options){
    var clips=Array.isArray(gltf&&gltf.animations)?gltf.animations:[];
    if(!clips.length) return validate({assetId,motionSupported:false});
    var clip=clips[0];
    return validate(Object.assign({assetId,motionSupported:true,motionType:'ROBOT_SEQUENCE',motionSource:'GLB_ANIMATION',animationClipName:clip.name||'default',targetNode:null,duration:clip.duration,loop:true,defaultSpeed:1},options||{}));
  }
  root.P006_ASSET_MOTION_CONTRACT={types:TYPES,validate:validate,fromGLTF:fromGLTF,flowMode:'FLOW_VISUALIZATION'};
})(typeof window==='undefined'?globalThis:window);
