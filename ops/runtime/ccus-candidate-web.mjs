import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.env.CCUS_FRONTEND_ROOT || '/opt/Resonance/runtime/current/frontend');
const backendHost = process.env.CCUS_BACKEND_HOST || '127.0.0.1';
const backendPort = Number(process.env.CCUS_BACKEND_PORT || 18080);
const port = Number(process.env.CCUS_WEB_PORT || 8080);
const types = new Map([['.html','text/html; charset=utf-8'],['.js','text/javascript; charset=utf-8'],['.css','text/css; charset=utf-8'],['.json','application/json; charset=utf-8'],['.svg','image/svg+xml'],['.png','image/png'],['.jpg','image/jpeg'],['.jpeg','image/jpeg'],['.webp','image/webp'],['.woff2','font/woff2'],['.wasm','application/wasm'],['.gz','application/gzip'],['.mp4','video/mp4']]);
const backendPattern = /^\/(?:en\/)?(?:api\/|admin\/api\/|signin\/api\/|actuator\/|runtime\/screens\/)|^\/(?:en\/)?signin\/(?:actionLogin|actionLogout|account-recovery\/|resetPassword)|^\/(?:en\/)?admin\/login\/(?:actionLogin|actionLogout)/;

function proxy(req,res){
  const upstream=http.request({hostname:backendHost,port:backendPort,path:req.url,method:req.method,headers:{...req.headers,host:`${backendHost}:${backendPort}`,'x-forwarded-proto':'http','x-forwarded-host':req.headers.host||''}},r=>{res.writeHead(r.statusCode||502,r.headers);r.pipe(res)});
  upstream.on('error',e=>{res.writeHead(502,{'content-type':'application/json; charset=utf-8'});res.end(JSON.stringify({error:'BACKEND_UNAVAILABLE',message:e.message}))});
  req.pipe(upstream);
}
function sendFile(file,res,noStore=false){
  const resolved=path.resolve(file); if(!resolved.startsWith(root+path.sep) && resolved!==path.join(root,'index.html')){res.writeHead(403);res.end();return}
  fs.stat(resolved,(err,st)=>{if(err||!st.isFile()){res.writeHead(404);res.end('Not found');return} const ext=path.extname(resolved).toLowerCase();res.writeHead(200,{'content-type':types.get(ext)||'application/octet-stream','content-length':st.size,'cache-control':noStore?'no-store':'public, max-age=31536000, immutable'});fs.createReadStream(resolved).pipe(res)});
}
http.createServer((req,res)=>{
  const pathname=decodeURIComponent(new URL(req.url||'/','http://localhost').pathname);
  if(backendPattern.test(pathname)||/^\/(?:en\/)?home\/api\//.test(pathname)||/^\/(?:en\/)?admin\/system\/menu-data\/?$/.test(pathname)||/\/page-data\/?$/.test(pathname)) return proxy(req,res);
  if(pathname.startsWith('/assets/react/')) return sendFile(path.join(root,pathname.slice('/assets/react/'.length)),res);
  const direct=path.join(root,pathname.replace(/^\//,''));
  if(pathname!=='/' && fs.existsSync(direct) && fs.statSync(direct).isFile()) return sendFile(direct,res);
  return sendFile(path.join(root,'index.html'),res,true);
}).listen(port,'0.0.0.0',()=>console.log(`CCUS web listening on ${port}; frontend=${root}; backend=${backendHost}:${backendPort}`));
