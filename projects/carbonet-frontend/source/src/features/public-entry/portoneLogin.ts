type VerificationStart = { storeId: string; channelKey: string; identityVerificationId: string; csrf: string };
type VerificationResponse = { code?: string; identityVerificationId?: string };
type PortOneSdk = { requestIdentityVerification: (input: Record<string, unknown>) => Promise<VerificationResponse | undefined> };
let sdkPromise: Promise<PortOneSdk> | undefined;
function loadSdk(): Promise<PortOneSdk> {
  const browser = window as Window & { PortOne?: PortOneSdk };
  if (browser.PortOne) return Promise.resolve(browser.PortOne);
  if (!sdkPromise) sdkPromise = new Promise<PortOneSdk>((resolve, reject) => {
    const script = document.createElement('script');
    const timer = window.setTimeout(() => { script.remove(); reject(new Error('인증 SDK 연결 시간이 초과되었습니다.')); }, 20000);
    script.src = 'https://cdn.portone.io/v2/browser-sdk.js';
    script.onload = () => { clearTimeout(timer); browser.PortOne ? resolve(browser.PortOne) : reject(new Error('인증 SDK를 준비하지 못했습니다.')); };
    script.onerror = () => { clearTimeout(timer); script.remove(); reject(new Error('인증 SDK를 불러오지 못했습니다.')); };
    document.head.append(script);
  }).catch(error => { sdkPromise = undefined; throw error; });
  return sdkPromise;
}
async function post<T>(action: string, input: unknown): Promise<T> {
  const response = await fetch(`/api/identity/portone-test/${action}`, { method: 'POST', credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
  const value = await response.json();
  if (!response.ok) throw new Error(value.message || '인증 요청을 처리하지 못했습니다. 잠시 후 다시 시도하세요.');
  return value as T;
}
// Test channel only: never establish login or change account permissions here.
export async function launchPortOneLogin(): Promise<{ verified: boolean; message: string }> {
  if (location.protocol !== 'https:') {
    const admin = /\/(?:en\/)?admin\//.test(location.pathname);
    const path = (location.pathname.startsWith('/en/') ? '/en' : '') + (admin ? '/admin/login/loginView' : '/signin/loginView');
    location.assign(`https://production.172.16.1.232.nip.io${path}`);
    return { verified: false, message: '보안 로그인 화면으로 이동합니다. 해당 화면에서 아이디·비밀번호를 입력하고 통합인증을 진행해 주세요.' };
  }
  const sdk = await loadSdk();
  const pending = await post<VerificationStart>('start', { consent: true });
  const key = 'ccus.portone.test.pending';
  sessionStorage.setItem(key, JSON.stringify(pending));
  let awaitingRedirect = false;
  try {
    const response = await sdk.requestIdentityVerification({ storeId: pending.storeId, channelKey: pending.channelKey,
      identityVerificationId: pending.identityVerificationId, redirectUrl: `${location.origin}/portone-test.html`,
      bypass: { inicisUnified: { flgFixedUser: 'N', FRGNDInfo: 'N' } } });
    if (!response) { awaitingRedirect = true; return { verified: false, message: '인증창에서 본인 인증을 진행해 주세요.' }; }
    if (response.code !== undefined) throw new Error('인증이 취소되었거나 완료되지 않았습니다.');
    if (response.identityVerificationId !== pending.identityVerificationId) throw new Error('인증 요청이 일치하지 않습니다. 다시 시작해 주세요.');
    const result = await post<{ verified: boolean; message?: string }>('complete', { identityVerificationId: pending.identityVerificationId, csrf: pending.csrf });
    if (!result.verified) throw new Error('인증 결과를 확인하지 못했습니다.');
    return { verified: true, message: '본인인증 결과를 확인했습니다. 입력한 계정의 비밀번호와 로그인 정책을 확인합니다.' };
  } finally { if (!awaitingRedirect) sessionStorage.removeItem(key); }
}
