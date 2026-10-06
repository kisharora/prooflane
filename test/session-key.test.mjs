import test from 'node:test';
import assert from 'node:assert/strict';
import { SessionKey, isLoopbackRequest } from '../lib/session-key.mjs';
const DUMMY = 'not_a_real_credential_for_test';
test('one-run key is held privately and consumed exactly once', () => {
  const key = new SessionKey(); key.set(DUMMY);
  assert.equal(key.status().configured, true); assert.ok(!JSON.stringify(key).includes(DUMMY)); assert.ok(!JSON.stringify(key.status()).includes(DUMMY));
  assert.equal(key.take(), DUMMY); assert.equal(key.take(), ''); assert.equal(key.status().configured, false);
});
test('one-run key expires after ten minutes and can be explicitly cleared', () => {
  let time = 1000; const key = new SessionKey({ now: () => time }); key.set(DUMMY); time += 600001;
  assert.equal(key.status().configured, false); assert.equal(key.take(), ''); key.set(DUMMY); key.clear(); assert.equal(key.take(), '');
});
test('invalid key values are rejected without being echoed', () => {
  const key = new SessionKey();
  for (const value of ['short', ' spaces and punctuation ! ', {}, null]) assert.throws(() => key.set(value), error => error.code === 'INVALID_KEY_FORMAT' && !error.message.includes(String(value)));
});
test('local handoff requires both loopback peer and localhost host header', () => {
  const request = (host, remoteAddress) => ({ headers: { host }, socket: { remoteAddress } });
  assert.equal(isLoopbackRequest(request('127.0.0.1:4173', '127.0.0.1')), true);
  assert.equal(isLoopbackRequest(request('localhost:4173', '::ffff:127.0.0.1')), true);
  assert.equal(isLoopbackRequest(request('evil.example:4173', '127.0.0.1')), false);
  assert.equal(isLoopbackRequest(request('localhost:4173', '192.168.1.10')), false);
});
