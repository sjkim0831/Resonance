import{r as s}from"./vendor-react-DQCpd17N.js";/**
 * @license lucide-react v1.18.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const h=(...e)=>e.filter((t,o,r)=>!!t&&t.trim()!==""&&r.indexOf(t)===o).join(" ").trim();/**
 * @license lucide-react v1.18.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const v=e=>e.replace(/([a-z0-9])([A-Z])/g,"$1-$2").toLowerCase();/**
 * @license lucide-react v1.18.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const L=e=>e.replace(/^([A-Z])|[\s-_]+(\w)/g,(t,o,r)=>r?r.toUpperCase():o.toLowerCase());/**
 * @license lucide-react v1.18.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const d=e=>{const t=L(e);return t.charAt(0).toUpperCase()+t.slice(1)};/**
 * @license lucide-react v1.18.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */var i={xmlns:"http://www.w3.org/2000/svg",width:24,height:24,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:2,strokeLinecap:"round",strokeLinejoin:"round"};/**
 * @license lucide-react v1.18.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const y=e=>{for(const t in e)if(t.startsWith("aria-")||t==="role"||t==="title")return!0;return!1},A=s.createContext({}),b=()=>s.useContext(A),W=s.forwardRef(({color:e,size:t,strokeWidth:o,absoluteStrokeWidth:r,className:c="",children:a,iconNode:p,...l},C)=>{const{size:n=24,strokeWidth:u=2,absoluteStrokeWidth:f=!1,color:m="currentColor",className:w=""}=b()??{},k=r??f?Number(o??u)*24/Number(t??n):o??u;return s.createElement("svg",{ref:C,...i,width:t??n??i.width,height:t??n??i.height,stroke:e??m,strokeWidth:k,className:h("lucide",w,c),...!a&&!y(l)&&{"aria-hidden":"true"},...l},[...p.map(([x,g])=>s.createElement(x,g)),...Array.isArray(a)?a:[a]])});/**
 * @license lucide-react v1.18.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const S=(e,t)=>{const o=s.forwardRef(({className:r,...c},a)=>s.createElement(W,{ref:a,iconNode:t,className:h(`lucide-${v(d(e))}`,`lucide-${e}`,r),...c}));return o.displayName=d(e),o};/**
 * @license lucide-react v1.18.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const E=[["path",{d:"M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8",key:"v9h5vc"}],["path",{d:"M21 3v5h-5",key:"1q7to0"}],["path",{d:"M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16",key:"3uifl3"}],["path",{d:"M8 16H3v5",key:"1cv678"}]],R=S("refresh-cw",E);export{R,S as c};
