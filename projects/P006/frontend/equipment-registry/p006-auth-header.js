(()=>{
 if(window.top!==window.self||document.querySelector('#p006AuthHeader'))return;
 const bar=document.createElement('div');bar.id='p006AuthHeader';bar.style.cssText='display:flex;align-items:center;justify-content:flex-end;gap:12px;padding:8px 20px;background:#fff;border-bottom:1px solid #d5e2eb;color:#173a55;font:14px/1.5 Arial,sans-serif;position:relative;z-index:100';
 const status=document.createElement('span');status.textContent='P006 계정';
 const login=document.createElement('a');login.textContent='로그인';login.style.cssText='padding:7px 18px;border:1px solid #00838f;border-radius:6px;color:#007d89;text-decoration:none;background:#fff';
 const target=location.pathname+location.search+location.hash;
 login.href='/projects/P006/assets/equipment-registry/p006-login.html?returnTo='+encodeURIComponent(target);
 login.addEventListener('click',()=>{const current=location.pathname+location.search+location.hash;sessionStorage.setItem('p006-login-return',current);login.href='/projects/P006/assets/equipment-registry/p006-login.html?returnTo='+encodeURIComponent(current);});
 bar.append(status,login);document.body.prepend(bar);
 fetch('/projects/P006/authz',{credentials:'same-origin',cache:'no-store'}).then(async r=>{if(!r.ok)return;const d=await r.json();if(d.authenticated){status.textContent=(d.actor?.displayName||d.actor?.loginId||'계정')+' · 로그인됨';login.textContent='계정 로그인';}}).catch(()=>{});
})();
