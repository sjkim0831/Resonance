import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateVerification, checkVerification } from './portone-verification-check.mjs';
const expected = { id: 'test-id', storeId: 'store-test', channelKey: 'channel-test', mode: 'test', apiSecret: 'test-only' };
const valid = () => ({ id: expected.id, status: 'VERIFIED', channel: { key: expected.channelKey }, verifiedCustomer: { ci: 'synthetic-test-fixture' } });
test('email and DI are not required; account and session unchanged', () => {
  assert.deepEqual(validateVerification(valid(), expected), { verified: true, ciPresent: true, emailRequired: false, diRequired: false, mode: 'test', loginEnabled: false, accountUpdated: false });
});
for (const [name, mutate, reason] of [
  ['wrong id', r => r.id = 'other', 'IDENTITY_ID_MISMATCH'],
  ['pending', r => r.status = 'READY', 'NOT_VERIFIED'],
  ['wrong channel', r => r.channel.key = 'other', 'CHANNEL_MISMATCH'],
  ['missing channel', r => delete r.channel, 'CHANNEL_MISMATCH'],
  ['wrong store', r => r.storeId = 'other', 'STORE_MISMATCH'],
  ['missing CI', r => delete r.verifiedCustomer.ci, 'CI_REQUIRED'],
  ['blank CI', r => r.verifiedCustomer.ci = ' ', 'CI_REQUIRED']
]) test(name, () => { const r = valid(); mutate(r); assert.throws(() => validateVerification(r, expected), new RegExp(reason)); });
test('invalid id makes no API request', async () => {
  await assert.rejects(checkVerification(expected, '../secret', () => assert.fail('must not fetch')), /INVALID_ID/);
});
test('provider failure is not success', async () => {
  await assert.rejects(checkVerification(expected, expected.id, async () => ({ ok: false, status: 401 })), /PROVIDER_HTTP_401/);
});
test('API scoped to store and redirect blocked; output contains no CI', async () => {
  const result = await checkVerification(expected, expected.id, async (url, options) => {
    assert.equal(url.origin, 'https://api.portone.io');
    assert.equal(url.searchParams.get('storeId'), expected.storeId);
    assert.equal(options.redirect, 'error');
    return { ok: true, json: async () => valid() };
  });
  assert.ok(!JSON.stringify(result).includes('synthetic-test-fixture'));
});
