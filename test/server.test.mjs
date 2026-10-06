import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { EventEmitter } from 'node:events';
import { createServer } from '../server.mjs';
import { SerpApiClient } from '../lib/serpapi.mjs';
/** Exercise the real HTTP handler without opening a listening socket. */
async function request(server, { method = 'GET', path = '/', body, host = '127.0.0.1:4173', remote = '127.0.0.1', headers = {} } = {}) {
  const req = Readable.from(body === undefined ? [] : [typeof body === 'string' ? body : JSON.stringify(body)]);
  Object.assign(req, { method, url: path, headers: { host, ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...headers }, socket: { remoteAddress: remote } });
  const res = new EventEmitter(); res.writableEnded = false; res.writeHead = (status, headers) => { res.status = status; res.headers = headers; }; res.end = data => { res.body = data === undefined ? '' : String(data); res.writableEnded = true; };
  await server.listeners('request')[0](req, res);
  return { ...res, json: () => JSON.parse(res.body) };
}
test('local server serves the app and security headers', async () => {
  const res = await request(createServer({ apiKey: '' })); assert.equal(res.status, 200); assert.match(res.body, /Prooflane/); assert.equal(res.headers['X-Content-Type-Options'], 'nosniff'); assert.match(res.headers['Content-Security-Policy'], /object-src 'none'/);
});
test('API config never returns credentials and exposes local setup only on loopback', async () => {
  const server = createServer({ apiKey: '' });
  const local = (await request(server, { path: '/api/config' })).json(); assert.equal(local.localSetupAvailable, true); assert.equal(local.liveAvailable, false);
  const remote = (await request(server, { path: '/api/config', host: 'public.example', remote: '192.0.2.10' })).json(); assert.equal(remote.localSetupAvailable, false);
});
test('one-run key handoff returns no key, performs no searches, and can be forgotten', async () => {
  const server = createServer({ apiKey: '' }), key = 'dummy_test_value_not_a_credential';
  const setup = await request(server, { method: 'POST', path: '/api/session-key', body: { key } }); assert.equal(setup.status, 200); assert.ok(!setup.body.includes(key));
  const config = (await request(server, { path: '/api/config' })).json(); assert.equal(config.liveAvailable, true); assert.equal(config.keySource, 'session');
  const cleared = await request(server, { method: 'DELETE', path: '/api/session-key' }); assert.equal(cleared.json().configured, false);
  assert.equal((await request(server, { path: '/api/config' })).json().liveAvailable, false);
});
test('remote addresses and DNS-rebinding hosts cannot enter a key', async () => {
  const server = createServer({ apiKey: '' }), body = { key: 'dummy_test_value_not_a_credential' };
  for (const extra of [{ host: 'evil.example' }, { remote: '192.0.2.1' }]) {
    const response = await request(server, { method: 'POST', path: '/api/session-key', body, ...extra }); assert.equal(response.status, 403);
  }
});
test('cross-origin API calls and non-JSON setup are denied', async () => {
  const server = createServer({ apiKey: '' });
  assert.equal((await request(server, { method: 'POST', path: '/api/session-key', body: {}, headers: { origin: 'https://evil.example' } })).status, 403);
  assert.equal((await request(server, { method: 'POST', path: '/api/session-key', body: {}, headers: { 'content-type': 'text/plain' } })).status, 415);
});
test('keys, server source, and traversal paths are not served', async () => {
  const server = createServer({ apiKey: '' });
  assert.equal((await request(server, { path: '/.env' })).status, 403);
  assert.equal((await request(server, { path: '/server.mjs' })).status, 404);
  assert.equal((await request(server, { path: '/..%2f.env' })).status, 403);
});
test('research endpoint handles missing config, method, malformed JSON, and excessive budget', async () => {
  const noKey = createServer({ apiKey: '' }); assert.equal((await request(noKey, { method: 'POST', path: '/api/research', body: {} })).status, 503);
  const configured = createServer({ apiKey: 'dummy_test_value_not_a_credential' });
  assert.equal((await request(configured, { path: '/api/research' })).status, 405);
  assert.equal((await request(configured, { method: 'POST', path: '/api/research', body: '{bad' })).status, 400);
  assert.equal((await request(configured, { method: 'POST', path: '/api/research', body: { skill: 'Design', budget: 100 } })).status, 400);
});
test('complete API run uses the actual adapter contract without leaking provider keys', async () => {
  let calls = 0; const key = 'dummy_test_value_not_a_credential';
  const client = new SerpApiClient({ apiKey: key, fetchImpl: async () => { calls++; return new Response(JSON.stringify({ search_metadata: { status: 'Success' }, search_parameters: { api_key: key }, organic_results: [{ title: 'Analytics product launch project', link: 'https://example.com/project', snippet: 'Paid freelance project $1000 remote', date: '2 days ago' }] }), { status: 200 }); } });
  const response = await request(createServer({ apiKey: '', client }), { method: 'POST', path: '/api/research', body: { skill: 'Design', budget: 3, remote: true } });
  assert.equal(response.status, 200); assert.equal(response.json().mode, 'live'); assert.equal(response.json().candidates.length, 1); assert.equal(calls, 3); assert.ok(!response.body.includes(key));
});
test('environment and one-run research both reject non-loopback peers and rebinding hosts', async () => {
  let calls = 0;
  const client = new SerpApiClient({ apiKey: 'dummy_test_value_not_a_credential', fetchImpl: async () => { calls++; throw new Error('This provider call must never be reached.'); } });
  const environmentServer = createServer({ apiKey: 'dummy_test_value_not_a_credential', client });
  const sessionServer = createServer({ apiKey: '' });
  await request(sessionServer, { method: 'POST', path: '/api/session-key', body: { key: 'dummy_test_value_not_a_credential' } });
  for (const server of [environmentServer, sessionServer]) {
    for (const extra of [
      { host: 'untrusted.example:4173', headers: { origin: 'http://untrusted.example:4173' } },
      { remote: '192.0.2.50' },
    ]) {
      const result = await request(server, { method: 'POST', path: '/api/research', body: { skill: 'Design', budget: 3 }, ...extra });
      assert.equal(result.status, 403); assert.equal(result.json().code, 'LOCAL_ONLY');
    }
  }
  assert.equal(calls, 0);
  assert.equal((await request(sessionServer, { path: '/api/config' })).json().liveAvailable, true, 'Rejected research must not consume a prepared one-run key');
});
