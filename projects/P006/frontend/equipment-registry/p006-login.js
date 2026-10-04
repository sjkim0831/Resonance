(()=>{
 const fallback='/projects/P006/assets/equipment-registry/equipment-studio.html';
 function safeTarget(raw){try{const u=new URL(raw,location.origin);return u.origin===location.origin&&/^\/(projects\/P006\/|r\/P006\/)/.test(u.pathname)&&!u.pathname.endsWith('/p006-login.html')?u.pathname+u.search+u.hash:fallback;}catch{return fallback;}}
 const raw=new URLSearchParams(location.search).get('returnTo');const target=safeTarget(raw||sessionStorage.getItem('p006-login-return')||fallback);
 document.querySelector('#returnPage').href=target;
 document.querySelector('#loginForm').addEventListener('submit',async e=>{e.preventDefault();const b=document.querySelector('#loginSubmit'),status=document.querySelector('#loginStatus');b.disabled=true;status.textContent='로그인 중…';try{const r=await fetch('/r/P006/actuator/p006/auth/login',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({loginId:document.querySelector('#loginId').value.trim(),password:document.querySelector('#password').value})});let data={};try{data=await r.json();}catch{}if(!r.ok)throw Error(r.status===401?'아이디 또는 비밀번호를 확인하세요.':data.message||data.error||`로그인 오류 (${r.status})`);sessionStorage.removeItem('p006-login-return');location.replace(target);}catch(error){status.textContent=error.message;b.disabled=false;}});
})();
