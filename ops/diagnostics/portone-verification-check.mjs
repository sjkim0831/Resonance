import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

// Read-only diagnostic adapter. Never issues sessions or updates accounts.
export function validateVerification(record, expected) {
  if (!expected.id || !expected.storeId || !expected.channelKey) throw new Error('INVALID_EXPECTATION');
  if (record?.id !== expected.id) throw new Error('IDENTITY_ID_MISMATCH');
  if (record.status !== 'VERIFIED') throw new Error('NOT_VERIFIED');
  if (record.channel?.key !== expected.channelKey) throw new Error('CHANNEL_MISMATCH');
  // The authenticated API request is explicitly scoped to the configured store.
  if (record.storeId !== undefined && record.storeId !== expected.storeId) throw new Error('STORE_MISMATCH');
  if (typeof record.verifiedCustomer?.ci !== 'string' || !record.verifiedCustomer.ci.trim()) throw new Error('CI_REQUIRED');
  return { verified: true, ciPresent: true, emailRequired: false, diRequired: false,
    mode: expected.mode, loginEnabled: false, accountUpdated: false };
}

export async function checkVerification(config, id, fetcher = fetch) {
  if (!/^[-a-zA-Z0-9_]{1,100}$/.test(id)) throw new Error('INVALID_ID');
  const url = new URL(`https://api.portone.io/identity-verifications/${encodeURIComponent(id)}`);
  url.searchParams.set('storeId', config.storeId);
  const response = await fetcher(url, { headers: { Authorization: `PortOne ${config.apiSecret}` },
    redirect: 'error', signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`PROVIDER_HTTP_${response.status}`);
  return validateVerification(await response.json(), { ...config, id });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const config = JSON.parse(await readFile('/opt/Resonance/.secrets/portone-identity.json', 'utf8'));
    const result = await checkVerification(config, process.argv[2] || '');
    process.stdout.write(JSON.stringify(result) + '\n');
  } catch (error) {
    // Do not expose provider body, personal information or credentials.
    const safe = /^(INVALID_|IDENTITY_|NOT_VERIFIED|CHANNEL_|STORE_|CI_REQUIRED|PROVIDER_HTTP_)/.test(error.message);
    process.stderr.write(JSON.stringify({ verified: false, error: safe ? error.message : 'VERIFICATION_UNAVAILABLE' }) + '\n');
    process.exitCode = 1;
  }
}
