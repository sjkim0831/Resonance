import { readFile } from 'node:fs/promises';
import { randomBytes, createHash } from 'node:crypto';
import { checkVerification } from '../diagnostics/portone-verification-check.mjs';

const prefix = '/api/identity/portone-test/';
const cookieName = '__Host-ccus-portone-test';
const digest = value => createHash('sha256').update(value).digest('hex');
const token = () => randomBytes(32).toString('hex');
const ttl = 10 * 60_000;
function json(res, code, value, extra = {}) {
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store',
    'x-content-type-options': 'nosniff', ...extra });
  res.end(JSON.stringify(value));
}
async function body(req) {
  let data = '';
  for await (const chunk of req) { data += chunk; if (data.length > 2048) throw new Error('BODY_TOO_LARGE'); }
  return JSON.parse(data || '{}');
}
export function createPortOneTestHandler({ loadConfig, verify = checkVerification, now = Date.now,
  audit = event => console.info('[ccus-portone-audit]', JSON.stringify(event)) } = {}) {
  const attempts = new Map();
  const limits = new Map();
  loadConfig ||= async () => JSON.parse(await readFile(`${process.env.CREDENTIALS_DIRECTORY}/portone-identity.json`, 'utf8'));
  return function handle(req, res) {
    const pathname = (req.url || '').split('?')[0];
    if (!pathname.startsWith(prefix)) return false;
    let reference = '';
    void (async () => {
      // Require real TLS at this edge; do not trust caller-supplied forwarding headers.
      const origin = `https://${req.headers.host}`;
      if (!req.socket.encrypted || req.headers.origin !== origin) return json(res, 403, { code: 'SECURE_ORIGIN_REQUIRED' });
      if (req.method !== 'POST' || !String(req.headers['content-type']).startsWith('application/json')) return json(res, 405, { code: 'JSON_POST_REQUIRED' });
      if (!['start', 'complete'].includes(pathname.slice(prefix.length))) return json(res, 404, { code: 'NOT_FOUND' });
      const input = await body(req);
      const timestamp = now();
      for (const [key, item] of attempts) if (item.expiresAt <= timestamp) attempts.delete(key);
      for (const [key, item] of limits) if (item.expiresAt <= timestamp) limits.delete(key);
      const config = await loadConfig();
      // This route can never be used for production verification or login.
      if (config.mode !== 'test') return json(res, 409, { code: 'TEST_CHANNEL_REQUIRED' });
      const sessionCookie = (req.headers.cookie || '').split(';').map(s => s.trim()).find(s => s.startsWith(cookieName + '='))?.slice(cookieName.length + 1) || '';
      if (pathname.endsWith('/start')) {
        const address = digest(String(req.socket.remoteAddress));
        const limit = limits.get(address) || { count: 0, expiresAt: timestamp + ttl };
        if (limit.count >= 5 || attempts.size >= 1000 || limits.size >= 1000) return json(res, 429, { code: 'TRY_LATER' });
        if (input.consent !== true) return json(res, 400, { code: 'CONSENT_REQUIRED' });
        limit.count++; limits.set(address, limit);
        const session = token(); const csrf = token(); const id = `ccus-test-${token()}`;
        if (sessionCookie) for (const [key, item] of attempts) if (item.sessionHash === digest(sessionCookie)) attempts.delete(key);
        attempts.set(id, { sessionHash: digest(session), csrf, expiresAt: timestamp + ttl });
        return json(res, 200, { storeId: config.storeId, channelKey: config.channelKey,
          identityVerificationId: id, csrf, expiresAt: timestamp + ttl, mode: 'test', loginEnabled: false },
          { 'set-cookie': `${cookieName}=${session}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600` });
      }
      const attempt = attempts.get(input.identityVerificationId);
      if (!attempt || !sessionCookie || attempt.sessionHash !== digest(sessionCookie) || attempt.csrf !== input.csrf)
        return json(res, 400, { code: 'INVALID_OR_EXPIRED_ATTEMPT' });
      // Consume atomically before the network call: concurrent/replayed completions fail closed.
      attempts.delete(input.identityVerificationId);
      reference = digest(input.identityVerificationId).slice(0, 16);
      const result = await verify(config, input.identityVerificationId);
      audit({ at: new Date(now()).toISOString(), reference, status: 'VERIFIED', mode: 'test', loginIssued: false });
      return json(res, 200, { ...result, reference, message: `본인인증 결과를 서버에서 확인했습니다. 테스트이므로 계정 연결과 로그인은 하지 않았습니다. 확인번호: ${reference}` },
        { 'set-cookie': `${cookieName}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0` });
    })().catch(error => {
      if (reference) {
        const known = /^(IDENTITY_ID_MISMATCH|NOT_VERIFIED|CHANNEL_MISMATCH|STORE_MISMATCH|CI_REQUIRED|PROVIDER_HTTP_[0-9]{3})$/;
        audit({ at: new Date(now()).toISOString(), reference, status: 'FAILED', mode: 'test',
          reason: known.test(error?.message || '') ? error.message : 'VERIFICATION_UNAVAILABLE', loginIssued: false });
      }
      json(res, 400, { code: 'VERIFICATION_FAILED', reference, message: `인증을 확인하지 못했습니다. 새 인증으로 다시 시도하세요.${reference ? ' 확인번호: ' + reference : ''}` });
    });
    return true;
  };
}
